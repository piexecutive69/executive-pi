export function isAddressComplete(address) {
  if (!address || typeof address !== 'object') return false
  const addressLine = String(address.addressLine || '').trim()
  return Boolean(
    addressLine &&
      address.provinceId &&
      address.regencyId &&
      address.districtId &&
      address.villageId,
  )
}

