const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { dbQuery } = require('../db');
const { authenticateToken, requireOwner, requireStrictOwner, logAudit } = require('../middleware/auth');

// GET /api/settings
// Get all store profile and receipt settings (public / accessible by all authenticated users)
router.get('/', async (req, res) => {
  try {
    const rows = await dbQuery.all('SELECT key, value FROM store_settings');
    const settings = {};
    if (rows && rows.length > 0) {
      rows.forEach(r => {
        settings[r.key] = r.value;
      });
    }

    // Provide default fallbacks if not yet seeded
    const responseData = {
      store_name: settings.store_name || 'PD. HASIL BUMI RAYA 1',
      store_tagline: settings.store_tagline || 'Pusat Umbi, Bawang & Komoditas Pasar',
      store_address: settings.store_address || 'Pasar induk modern, Cikopo, Kec. Campaka, Kabupaten Purwakarta, Jawa Barat 41183',
      store_phone: settings.store_phone || '0812-3456-7890',
      receipt_footer: settings.receipt_footer || 'Terima kasih atas kunjungan Anda!\nBarang yang sudah ditimbang & dibeli tidak dapat ditukar/dikembalikan.',
      ...settings
    };

    return res.json({
      success: true,
      settings: responseData
    });
  } catch (err) {
    console.error('Error fetching settings:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengambil pengaturan toko: ' + err.message });
  }
});

// PUT /api/settings
// Update store identity & receipt settings (Owner only)
router.put('/', authenticateToken, requireStrictOwner, async (req, res) => {
  try {
    const { store_name, store_tagline, store_address, store_phone, receipt_footer } = req.body;

    if (!store_name || !store_name.trim()) {
      return res.status(400).json({ success: false, message: 'Nama toko tidak boleh kosong' });
    }

    const updates = {
      store_name: store_name.trim(),
      store_tagline: (store_tagline || '').trim(),
      store_address: (store_address || '').trim(),
      store_phone: (store_phone || '').trim(),
      receipt_footer: (receipt_footer || '').trim()
    };

    for (const [key, value] of Object.entries(updates)) {
      await dbQuery.run(
        `INSERT INTO store_settings (key, value, updated_at)
         VALUES (?, ?, datetime('now', 'localtime'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, value]
      );
    }

    await logAudit(req.user.id, 'STORE_SETTINGS_UPDATED', updates);

    return res.json({
      success: true,
      message: 'Identitas toko & footer struk berhasil diperbarui!',
      settings: updates
    });
  } catch (err) {
    console.error('Error updating settings:', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui pengaturan: ' + err.message });
  }
});

// POST /api/settings/change-owner-pin
// Change Owner security PIN
router.post('/change-owner-pin', authenticateToken, requireStrictOwner, async (req, res) => {
  try {
    const { old_pin, new_pin } = req.body;

    if (!old_pin || !new_pin) {
      return res.status(400).json({ success: false, message: 'PIN lama dan PIN baru wajib diisi' });
    }

    if (new_pin.length < 4 || new_pin.length > 6 || isNaN(Number(new_pin))) {
      return res.status(400).json({ success: false, message: 'PIN baru harus berupa 4-6 digit angka' });
    }

    const owner = await dbQuery.get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!owner) {
      return res.status(404).json({ success: false, message: 'User owner tidak ditemukan' });
    }

    const isMatch = await bcrypt.compare(old_pin, owner.pin_code);
    if (!isMatch) {
      await logAudit(req.user.id, 'OWNER_PIN_CHANGE_FAILED', { reason: 'Incorrect old PIN' });
      return res.status(400).json({ success: false, message: 'PIN lama salah' });
    }

    const newPinHash = await bcrypt.hash(new_pin, 8);
    await dbQuery.run('UPDATE users SET pin_code = ? WHERE id = ?', [newPinHash, req.user.id]);

    await logAudit(req.user.id, 'OWNER_PIN_CHANGED', { user_id: req.user.id });

    return res.json({
      success: true,
      message: 'PIN berhasil diubah! Gunakan PIN baru ini untuk login berikutnya.'
    });
  } catch (err) {
    console.error('Error changing pin:', err);
    return res.status(500).json({ success: false, message: 'Gagal mengubah PIN: ' + err.message });
  }
});

// PUT /api/settings/profile (Edit identitas nama profil kasir/admin saat ini & ganti PIN)
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { name, old_pin, new_pin } = req.body;
    const userId = req.user.id;

    const user = await dbQuery.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Akun user tidak ditemukan' });
    }

    let finalName = user.name;
    if (name && name.trim()) {
      finalName = name.trim();
    }

    let finalPinHash = user.pin_code;
    let pinChanged = false;

    if (new_pin) {
      if (!old_pin) {
        return res.status(400).json({ success: false, message: 'PIN lama diperlukan untuk memverifikasi penggantian PIN' });
      }
      const isMatch = await bcrypt.compare(String(old_pin), user.pin_code);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'PIN lama tidak cocok' });
      }
      if (String(new_pin).length < 4 || String(new_pin).length > 6 || isNaN(Number(new_pin))) {
        return res.status(400).json({ success: false, message: 'PIN baru harus berupa 4 sampai 6 digit angka' });
      }
      finalPinHash = await bcrypt.hash(String(new_pin), 8);
      pinChanged = true;
    }

    await dbQuery.run('UPDATE users SET name = ?, pin_code = ? WHERE id = ?', [finalName, finalPinHash, userId]);

    await logAudit(userId, 'USER_PROFILE_UPDATED', {
      user_id: userId,
      old_name: user.name,
      new_name: finalName,
      pin_changed: pinChanged
    });

    return res.json({
      success: true,
      message: pinChanged
        ? `Identitas nama diubah menjadi "${finalName}" dan PIN berhasil diperbarui!`
        : `Identitas nama berhasil diperbarui menjadi "${finalName}"!`,
      user: {
        id: user.id,
        name: finalName,
        username: user.username,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Error in PUT /api/settings/profile:', err);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui profil: ' + err.message });
  }
});

module.exports = router;
