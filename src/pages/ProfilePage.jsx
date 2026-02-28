import { Bell, CircleHelp, CreditCard, Settings, ShoppingBag, UserRound } from 'lucide-react'

const profileMenus = [
  { label: 'My Orders', icon: ShoppingBag },
  { label: 'Wishlist', icon: UserRound },
  { label: 'Notifications', icon: Bell },
  { label: 'Settings', icon: Settings },
  { label: 'Payment Methods', icon: CreditCard },
  { label: 'Help Center', icon: CircleHelp },
]

export default function ProfilePage() {
  return (
    <section className="pb-20">
      <h2 className="mb-3 text-[17px] font-medium text-[#e3ebfb]">Profile</h2>
      <div className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 shadow-[0_1px_4px_rgba(0,0,0,.24)]">
        <div className="flex items-center gap-3">
          <img src="/assets/img/profile.jpg" alt="Don Normane" className="h-16 w-16 rounded-full object-cover" />
          <div>
            <p className="text-[16px] font-medium leading-tight text-[#e3ebfb]">Don Normane</p>
            <p className="text-[12px] text-[#8ea6d7]">ID MD 4350</p>
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {profileMenus.map((menu) => (
          <button
            key={menu.label}
            type="button"
            className="flex w-full items-center gap-3 rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] px-3 py-3 text-left shadow-[0_1px_4px_rgba(0,0,0,.24)]"
          >
            <menu.icon className="h-4 w-4 text-[#9fb4df]" strokeWidth={2} />
            <span className="text-[14px] text-[#c4d3f2]">{menu.label}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
