import { useMemo, useState } from 'react'

const cartSeed = [
  { id: 1, name: 'Leather Bag', variant: 'Bag', idr: 320000, pi: 3.2, image: '/assets/img/products/product1.png' },
  { id: 2, name: 'Sports Shoe', variant: 'Shoe', idr: 120000, pi: 1.2, image: '/assets/img/products/product3.png' },
]

export default function CartPage() {
  const [items, setItems] = useState(
    cartSeed.map((item) => ({
      ...item,
      qty: 1,
    })),
  )

  const updateQty = (id, step) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item
        return { ...item, qty: Math.max(1, item.qty + step) }
      }),
    )
  }

  const summary = useMemo(() => {
    const subtotalIdr = items.reduce((sum, item) => sum + item.idr * item.qty, 0)
    const subtotalPi = items.reduce((sum, item) => sum + item.pi * item.qty, 0)
    const shippingIdr = 12000
    const shippingPi = 0.1
    return {
      subtotalIdr,
      subtotalPi,
      shippingIdr,
      shippingPi,
      totalIdr: subtotalIdr + shippingIdr,
      totalPi: subtotalPi + shippingPi,
    }
  }, [items])

  return (
    <section className="pb-20">
      <h2 className="mb-3 text-[17px] font-medium text-[#e3ebfb]">Shopping Cart</h2>
      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id} className="rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-2 shadow-[0_1px_4px_rgba(0,0,0,.24)]">
            <div className="flex gap-2">
              <div className="grid h-[84px] w-[84px] shrink-0 place-items-center rounded-[4px] bg-[#162a57]">
                <img src={item.image} alt={item.name} className="max-h-[70px] w-auto object-contain" />
              </div>
              <div className="flex flex-1 flex-col justify-between">
                <div>
                  <h3 className="text-[15px] font-medium leading-tight text-[#e3ebfb]">{item.name}</h3>
                  <p className="text-[12px] text-[#8ea6d7]">{item.variant}</p>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-[12px]">
                    <p className="font-medium text-[#9fd0ff]">IDR {item.idr.toLocaleString('id-ID')}</p>
                    <p className="text-[#74b8ff]">{item.pi.toFixed(1)} Pi</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-full border border-[#6e8dc8]/35 px-2 py-1 text-[#c4d3f2]">
                    <button type="button" className="text-[15px]" onClick={() => updateQty(item.id, -1)}>
                      -
                    </button>
                    <span className="min-w-4 text-center text-[13px]">{item.qty}</span>
                    <button type="button" className="text-[15px]" onClick={() => updateQty(item.id, 1)}>
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-md border border-[#6e8dc8]/20 bg-[#121f3f] p-3 shadow-[0_1px_4px_rgba(0,0,0,.24)]">
        <h3 className="mb-2 text-[15px] font-medium text-[#e3ebfb]">Checkout Summary</h3>
        <div className="space-y-1 text-[12px] text-[#8ea6d7]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>IDR {summary.subtotalIdr.toLocaleString('id-ID')} | {summary.subtotalPi.toFixed(1)} Pi</span>
          </div>
          <div className="flex justify-between">
            <span>Shipping</span>
            <span>IDR {summary.shippingIdr.toLocaleString('id-ID')} | {summary.shippingPi.toFixed(1)} Pi</span>
          </div>
          <div className="mt-1 flex justify-between border-t border-[#6e8dc8]/25 pt-2 text-[13px] font-medium text-[#e3ebfb]">
            <span>Total</span>
            <span>IDR {summary.totalIdr.toLocaleString('id-ID')} | {summary.totalPi.toFixed(1)} Pi</span>
          </div>
        </div>
        <button type="button" className="mt-3 w-full rounded-full bg-[#274786] py-2 text-[13px] font-medium text-[#e3ebfb]">
          Proceed To Checkout
        </button>
      </div>
    </section>
  )
}
