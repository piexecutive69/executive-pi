import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import { api, toApiAssetUrl } from '../lib/api'

function toText(value) {
  return value == null ? '' : String(value)
}

export default function ProfileSettingsForm({ userId, user, lang, onUserUpdated }) {
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [savingAddress, setSavingAddress] = useState(false)
  const [error, setError] = useState('')

  const [profileForm, setProfileForm] = useState({
    name: '',
    email: '',
    phone: '',
  })
  const [currentImageUrl, setCurrentImageUrl] = useState('')
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmNewPassword: '',
  })

  const [addressForm, setAddressForm] = useState({
    addressLine: '',
    provinceId: '',
    regencyId: '',
    districtId: '',
    villageId: '',
    postalCode: '',
  })

  const [provinces, setProvinces] = useState([])
  const [regencies, setRegencies] = useState([])
  const [districts, setDistricts] = useState([])
  const [villages, setVillages] = useState([])

  const selectedImagePreview = useMemo(() => {
    if (!selectedImageFile) return ''
    return URL.createObjectURL(selectedImageFile)
  }, [selectedImageFile])

  useEffect(() => {
    return () => {
      if (selectedImagePreview) URL.revokeObjectURL(selectedImagePreview)
    }
  }, [selectedImagePreview])

  useEffect(() => {
    if (!userId) return
    let active = true

    async function loadSettings() {
      setLoading(true)
      setError('')
      try {
        const [profileRes, addressRes, provinceRes] = await Promise.all([
          api.getUserProfile(userId),
          api.getUserAddress(userId),
          api.listProvinces(),
        ])
        if (!active) return

        setProfileForm({
          name: toText(profileRes?.name || user?.name),
          email: toText(profileRes?.email || user?.email),
          phone: toText(profileRes?.phone),
        })
        setCurrentImageUrl(toApiAssetUrl(profileRes?.profile_image_url))

        const nextAddress = {
          addressLine: toText(addressRes?.addressLine),
          provinceId: toText(addressRes?.provinceId),
          regencyId: toText(addressRes?.regencyId),
          districtId: toText(addressRes?.districtId),
          villageId: toText(addressRes?.villageId),
          postalCode: toText(addressRes?.postalCode),
        }
        setAddressForm(nextAddress)
        setProvinces(Array.isArray(provinceRes) ? provinceRes : [])

        let regenciesRes = []
        let districtsRes = []
        let villagesRes = []

        if (nextAddress.provinceId) {
          regenciesRes = await api.listRegencies(nextAddress.provinceId)
          if (!active) return
          setRegencies(Array.isArray(regenciesRes) ? regenciesRes : [])
        } else {
          setRegencies([])
        }

        if (nextAddress.regencyId) {
          districtsRes = await api.listDistricts(nextAddress.regencyId)
          if (!active) return
          setDistricts(Array.isArray(districtsRes) ? districtsRes : [])
        } else {
          setDistricts([])
        }

        if (nextAddress.districtId) {
          villagesRes = await api.listVillages(nextAddress.districtId)
          if (!active) return
          setVillages(Array.isArray(villagesRes) ? villagesRes : [])
        } else {
          setVillages([])
        }

        if (!nextAddress.postalCode && nextAddress.villageId && villagesRes.length) {
          const selectedVillage = villagesRes.find((item) => String(item.id) === nextAddress.villageId)
          if (selectedVillage?.postalCode) {
            setAddressForm((prev) => ({ ...prev, postalCode: String(selectedVillage.postalCode) }))
          }
        }
      } catch (err) {
        if (!active) return
        setError(err.message || (lang === 'en' ? 'Failed to load settings.' : 'Gagal memuat pengaturan.'))
      } finally {
        if (active) setLoading(false)
      }
    }

    loadSettings()
    return () => {
      active = false
    }
  }, [lang, user?.email, user?.name, userId])

  const updateProfileField = (key, value) => {
    setProfileForm((prev) => ({ ...prev, [key]: value }))
  }

  const updateAddressField = (key, value) => {
    setAddressForm((prev) => ({ ...prev, [key]: value }))
  }

  const updatePasswordField = (key, value) => {
    setPasswordForm((prev) => ({ ...prev, [key]: value }))
  }

  const changeProvince = async (provinceId) => {
    setAddressForm((prev) => ({
      ...prev,
      provinceId,
      regencyId: '',
      districtId: '',
      villageId: '',
      postalCode: '',
    }))
    setRegencies([])
    setDistricts([])
    setVillages([])
    if (!provinceId) return
    try {
      const rows = await api.listRegencies(provinceId)
      setRegencies(Array.isArray(rows) ? rows : [])
    } catch (err) {
      toast.error(err.message || (lang === 'en' ? 'Failed to load regencies.' : 'Gagal memuat kabupaten/kota.'))
    }
  }

  const changeRegency = async (regencyId) => {
    setAddressForm((prev) => ({
      ...prev,
      regencyId,
      districtId: '',
      villageId: '',
      postalCode: '',
    }))
    setDistricts([])
    setVillages([])
    if (!regencyId) return
    try {
      const rows = await api.listDistricts(regencyId)
      setDistricts(Array.isArray(rows) ? rows : [])
    } catch (err) {
      toast.error(err.message || (lang === 'en' ? 'Failed to load districts.' : 'Gagal memuat kecamatan.'))
    }
  }

  const changeDistrict = async (districtId) => {
    setAddressForm((prev) => ({
      ...prev,
      districtId,
      villageId: '',
      postalCode: '',
    }))
    setVillages([])
    if (!districtId) return
    try {
      const rows = await api.listVillages(districtId)
      setVillages(Array.isArray(rows) ? rows : [])
    } catch (err) {
      toast.error(err.message || (lang === 'en' ? 'Failed to load villages.' : 'Gagal memuat kelurahan/desa.'))
    }
  }

  const changeVillage = (villageId) => {
    const selected = villages.find((item) => String(item.id) === villageId)
    setAddressForm((prev) => ({
      ...prev,
      villageId,
      postalCode: selected?.postalCode ? String(selected.postalCode) : prev.postalCode,
    }))
  }

  const saveProfile = async () => {
    if (!profileForm.name.trim() || !profileForm.email.trim()) {
      toast.error(lang === 'en' ? 'Name and email are required.' : 'Nama dan email wajib diisi.')
      return
    }

    setSavingProfile(true)
    try {
      let updatedUser = await api.updateUserProfile(userId, {
        name: profileForm.name.trim(),
        email: profileForm.email.trim(),
      })

      if (selectedImageFile) {
        updatedUser = await api.uploadUserProfileImage(userId, selectedImageFile)
        setCurrentImageUrl(toApiAssetUrl(updatedUser?.profile_image_url))
        setSelectedImageFile(null)
      }

      onUserUpdated?.(updatedUser)
      toast.success(lang === 'en' ? 'Profile updated.' : 'Profil berhasil diperbarui.')
    } catch (err) {
      toast.error(err.message || (lang === 'en' ? 'Failed to update profile.' : 'Gagal memperbarui profil.'))
    } finally {
      setSavingProfile(false)
    }
  }

  const saveAddress = async () => {
    setSavingAddress(true)
    try {
      const updated = await api.upsertUserAddress(userId, {
        addressLine: addressForm.addressLine.trim() || null,
        provinceId: addressForm.provinceId || null,
        regencyId: addressForm.regencyId || null,
        districtId: addressForm.districtId || null,
        villageId: addressForm.villageId || null,
        postalCode: addressForm.postalCode.trim() || null,
      })
      setAddressForm({
        addressLine: toText(updated?.addressLine),
        provinceId: toText(updated?.provinceId),
        regencyId: toText(updated?.regencyId),
        districtId: toText(updated?.districtId),
        villageId: toText(updated?.villageId),
        postalCode: toText(updated?.postalCode),
      })
      toast.success(lang === 'en' ? 'Address updated.' : 'Alamat berhasil diperbarui.')
    } catch (err) {
      toast.error(err.message || (lang === 'en' ? 'Failed to update address.' : 'Gagal memperbarui alamat.'))
    } finally {
      setSavingAddress(false)
    }
  }

  const savePassword = async () => {
    if (!passwordForm.newPassword || !passwordForm.confirmNewPassword) {
      toast.error(lang === 'en' ? 'All password fields are required.' : 'Semua field password wajib diisi.')
      return
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error(lang === 'en' ? 'New password must be at least 6 characters.' : 'Password baru minimal 6 karakter.')
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      toast.error(lang === 'en' ? 'Password confirmation does not match.' : 'Konfirmasi password tidak sama.')
      return
    }

    setSavingPassword(true)
    try {
      await api.updateUserPassword(userId, {
        newPassword: passwordForm.newPassword,
      })
      setPasswordForm({
        newPassword: '',
        confirmNewPassword: '',
      })
      toast.success(lang === 'en' ? 'Password updated.' : 'Password berhasil diperbarui.')
    } catch (err) {
      toast.error(err.message || (lang === 'en' ? 'Failed to update password.' : 'Gagal memperbarui password.'))
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="space-y-3">
      {loading ? <p className="text-[12px] text-[#8ea6d7]">{lang === 'en' ? 'Loading settings...' : 'Memuat pengaturan...'}</p> : null}
      {error ? <p className="rounded-md border border-red-400/30 bg-red-400/10 p-2 text-[12px] text-red-100">{error}</p> : null}

      <div className="grid grid-cols-3 gap-2 rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-2">
        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          className={`rounded-full py-2 text-[12px] font-medium ${activeTab === 'profile' ? 'bg-[#274786] text-[#e3ebfb]' : 'bg-[#162a57] text-[#9fb4df]'}`}
        >
          {lang === 'en' ? 'Profile' : 'Profil'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('address')}
          className={`rounded-full py-2 text-[12px] font-medium ${activeTab === 'address' ? 'bg-[#274786] text-[#e3ebfb]' : 'bg-[#162a57] text-[#9fb4df]'}`}
        >
          {lang === 'en' ? 'Address' : 'Alamat'}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('password')}
          className={`rounded-full py-2 text-[12px] font-medium ${activeTab === 'password' ? 'bg-[#274786] text-[#e3ebfb]' : 'bg-[#162a57] text-[#9fb4df]'}`}
        >
          {lang === 'en' ? 'Password' : 'Password'}
        </button>
      </div>

      {activeTab === 'profile' ? (
        <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3">
          <p className="mb-2 text-[13px] font-medium text-[#e3ebfb]">{lang === 'en' ? 'Profile Data' : 'Data Profil'}</p>
          <div className="space-y-2">
            <div className="flex items-center gap-3 rounded-xl border border-[#6e8dc8]/25 bg-[#162a57] px-3 py-2">
              <img
                src={selectedImagePreview || currentImageUrl || '/assets/img/profile.jpg'}
                alt="Profile"
                className="h-14 w-14 rounded-full object-cover"
                onError={(e) => {
                  e.currentTarget.onerror = null
                  e.currentTarget.src = '/assets/img/profile.jpg'
                }}
              />
              <div className="flex-1">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setSelectedImageFile(e.target.files?.[0] || null)}
                  className="w-full text-[12px] text-[#c4d3f2] file:mr-2 file:cursor-pointer file:rounded-full file:border-0 file:bg-[#274786] file:px-3 file:py-1 file:text-[11px] file:text-[#e3ebfb]"
                />
              </div>
            </div>

            <input
              type="text"
              value={profileForm.name}
              onChange={(e) => updateProfileField('name', e.target.value)}
              placeholder={lang === 'en' ? 'Name' : 'Nama'}
              className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#162a57] px-4 text-[13px] text-[#c4d3f2] outline-none placeholder:text-[#86a0d2]"
            />
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => updateProfileField('email', e.target.value)}
              placeholder="Email"
              className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#162a57] px-4 text-[13px] text-[#c4d3f2] outline-none placeholder:text-[#86a0d2]"
            />
            <input
              type="text"
              value={profileForm.phone}
              disabled
              placeholder={lang === 'en' ? 'Phone Number' : 'Nomor HP'}
              className="h-10 w-full cursor-not-allowed rounded-full border border-[#6e8dc8]/25 bg-[#112144] px-4 text-[13px] text-[#90a7d6] outline-none"
            />
            <button
              type="button"
              onClick={saveProfile}
              disabled={savingProfile}
              className="w-full cursor-pointer rounded-full bg-[#274786] py-2 text-[12px] font-medium text-[#e3ebfb] disabled:opacity-60"
            >
              {savingProfile
                ? lang === 'en'
                  ? 'Saving...'
                  : 'Menyimpan...'
                : lang === 'en'
                  ? 'Save Profile'
                  : 'Simpan Profil'}
            </button>

          </div>
        </div>
      ) : null}

      {activeTab === 'password' ? (
        <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3">
          <p className="mb-2 text-[13px] font-medium text-[#e3ebfb]">{lang === 'en' ? 'Update Password' : 'Update Password'}</p>
          <div className="space-y-2">
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => updatePasswordField('newPassword', e.target.value)}
              placeholder={lang === 'en' ? 'New password' : 'Password baru'}
              className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#112144] px-4 text-[13px] text-[#c4d3f2] outline-none placeholder:text-[#86a0d2]"
            />
            <input
              type="password"
              value={passwordForm.confirmNewPassword}
              onChange={(e) => updatePasswordField('confirmNewPassword', e.target.value)}
              placeholder={lang === 'en' ? 'Confirm new password' : 'Konfirmasi password baru'}
              className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#112144] px-4 text-[13px] text-[#c4d3f2] outline-none placeholder:text-[#86a0d2]"
            />
            <button
              type="button"
              onClick={savePassword}
              disabled={savingPassword}
              className="w-full cursor-pointer rounded-full border border-[#6e8dc8]/30 bg-[#1b3368] py-2 text-[12px] font-medium text-[#e3ebfb] disabled:opacity-60"
            >
              {savingPassword
                ? lang === 'en'
                  ? 'Updating...'
                  : 'Memperbarui...'
                : lang === 'en'
                  ? 'Update Password'
                  : 'Update Password'}
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === 'address' ? (
        <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3">
          <p className="mb-2 text-[13px] font-medium text-[#e3ebfb]">{lang === 'en' ? 'Address (Indonesia)' : 'Alamat (Indonesia)'}</p>
          <div className="space-y-2">
            <textarea
              value={addressForm.addressLine}
              onChange={(e) => updateAddressField('addressLine', e.target.value)}
              rows={3}
              placeholder={lang === 'en' ? 'Street / detailed address' : 'Jalan / alamat lengkap'}
              className="w-full rounded-xl border border-[#6e8dc8]/25 bg-[#162a57] px-4 py-2 text-[13px] text-[#c4d3f2] outline-none placeholder:text-[#86a0d2]"
            />

            <select
              value={addressForm.provinceId}
              onChange={(e) => changeProvince(e.target.value)}
              className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#162a57] px-4 text-[13px] text-[#c4d3f2] outline-none"
            >
              <option value="">{lang === 'en' ? 'Select Province' : 'Pilih Provinsi'}</option>
              {provinces.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>

            <select
              value={addressForm.regencyId}
              onChange={(e) => changeRegency(e.target.value)}
              disabled={!addressForm.provinceId}
              className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#162a57] px-4 text-[13px] text-[#c4d3f2] outline-none disabled:opacity-60"
            >
              <option value="">{lang === 'en' ? 'Select Regency/City' : 'Pilih Kabupaten/Kota'}</option>
              {regencies.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>

            <select
              value={addressForm.districtId}
              onChange={(e) => changeDistrict(e.target.value)}
              disabled={!addressForm.regencyId}
              className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#162a57] px-4 text-[13px] text-[#c4d3f2] outline-none disabled:opacity-60"
            >
              <option value="">{lang === 'en' ? 'Select District' : 'Pilih Kecamatan'}</option>
              {districts.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>

            <select
              value={addressForm.villageId}
              onChange={(e) => changeVillage(e.target.value)}
              disabled={!addressForm.districtId}
              className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#162a57] px-4 text-[13px] text-[#c4d3f2] outline-none disabled:opacity-60"
            >
              <option value="">{lang === 'en' ? 'Select Village' : 'Pilih Kelurahan/Desa'}</option>
              {villages.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>

            <input
              type="text"
              value={addressForm.postalCode}
              onChange={(e) => updateAddressField('postalCode', e.target.value)}
              placeholder={lang === 'en' ? 'Postal code' : 'Kode pos'}
              className="h-10 w-full rounded-full border border-[#6e8dc8]/25 bg-[#162a57] px-4 text-[13px] text-[#c4d3f2] outline-none placeholder:text-[#86a0d2]"
            />

            <button
              type="button"
              onClick={saveAddress}
              disabled={savingAddress}
              className="w-full cursor-pointer rounded-full bg-[#274786] py-2 text-[12px] font-medium text-[#e3ebfb] disabled:opacity-60"
            >
              {savingAddress
                ? lang === 'en'
                  ? 'Saving...'
                  : 'Menyimpan...'
                : lang === 'en'
                  ? 'Save Address'
                  : 'Simpan Alamat'}
            </button>

            {!provinces.length ? (
              <p className="text-[11px] text-[#8ea6d7]">
                {lang === 'en'
                  ? 'Province data is empty. Import wilayah Indonesia data into database first.'
                  : 'Data provinsi masih kosong. Import data wilayah Indonesia ke database terlebih dulu.'}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
