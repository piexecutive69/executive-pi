export default function ProductGrid({ items }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item, idx) => (
        <article key={`${item.name}-${idx}`} className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-2 shadow-[0_1px_4px_rgba(0,0,0,.24)]">
          <div className="relative h-[116px] rounded-[4px] bg-[#162a57]">
            <button
              type="button"
              className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-[#0b1632]"
              aria-label="Wishlist"
            >
              <img src="/assets/img/icons/heart-dark.svg" alt="" className="h-[13px] w-[13px]" />
            </button>
            <img src={item.image} alt={item.name} className="mx-auto h-full max-h-[100px] w-auto object-contain pt-2" />
          </div>
          <h4 className="mt-2 text-[19px] font-medium leading-tight text-[#e3ebfb]">{item.name}</h4>
          <p className="text-[14px] text-[#8ea6d7]">{item.category}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-[14px] leading-tight font-medium text-[#9fd0ff]">{item.idr}</p>
            <p className="text-[13px] leading-tight text-[#74b8ff]">{item.pi}</p>
          </div>
        </article>
      ))}
    </div>
  )
}
