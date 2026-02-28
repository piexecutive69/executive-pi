export default function Drawer({ open, onClose, menus }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-black/35 backdrop-blur-[1px] transition-opacity duration-300 ${open ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed right-0 top-0 z-40 h-full w-[286px] border-l border-[#6e8dc8]/30 bg-gradient-to-b from-[#111f43] to-[#0a142d] p-5 shadow-[-8px_0_24px_rgba(0,0,0,.35)] transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="rounded-2xl border border-[#6e8dc8]/20 bg-[#162a57]/65 p-4 text-center">
          <img src="/assets/img/profile.jpg" alt="Don Normane" className="mx-auto h-24 w-24 rounded-full object-cover ring-2 ring-white/70" />
          <p className="mt-3 text-[28px] font-medium leading-none text-[#e3ebfb]">Don Normane</p>
          <p className="mt-1 text-[12px] text-[#9cb2de]">ID MD 4350</p>
        </div>

        <ul className="mt-5 space-y-1">
          {menus.map((menu) => (
            <li key={menu.label}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[16px] text-[#c4d3f2] transition-colors hover:bg-[#1a3269]"
              >
                <img src={menu.icon} alt="" className="h-4 w-4" />
                {menu.label}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </>
  )
}
