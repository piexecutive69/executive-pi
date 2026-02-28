import { useEffect, useState } from 'react'
import { Dumbbell, ShoppingBag, Sparkles, UserRound, Venus } from 'lucide-react'
import ProductGrid from '../components/ProductGrid'

export default function HomePage({ heroSlides, categories, products }) {
  const [active, setActive] = useState(0)
  const categoryIcons = [UserRound, Venus, ShoppingBag, Sparkles, Dumbbell]

  useEffect(() => {
    const id = window.setInterval(() => setActive((prev) => (prev + 1) % heroSlides.length), 4500)
    return () => window.clearInterval(id)
  }, [heroSlides.length])

  return (
    <>
      <section className="rounded-[10px] border border-[#6e8dc8]/20 bg-[#121f3f] p-2 shadow-[0_1px_4px_rgba(0,0,0,.22)]">
        <div className="relative overflow-hidden rounded-[8px] bg-[#102043]">
          <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${active * 100}%)` }}>
            {heroSlides.map((slide) => (
              <article key={slide.t1} className="relative min-h-[220px] min-w-full">
                <img src={slide.image} alt={`${slide.t1} ${slide.t2}`} className="h-[220px] w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-white/95 via-white/65 to-transparent" />
                <div className="absolute left-3 top-14 z-10">
                  <h2 className="text-[20px] leading-[1.2] font-bold text-[#02011e]">
                    {slide.t1}
                    <br />
                    {slide.t2}
                  </h2>
                  <p className="mt-2 text-[32px] font-medium text-[#02011e]">{slide.offer}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="mt-2 flex gap-2 pl-1">
          {heroSlides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`h-[13px] w-[13px] rounded-full border ${i === active ? 'border-[#c4d3f2] bg-[#c4d3f2]' : 'border-[#6e8dc8] bg-transparent'}`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </section>

      <section className="mt-4">
        <h3 className="text-[16px] font-medium text-[#e3ebfb]">Categories</h3>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {categories.map((category, idx) => {
            const Icon = categoryIcons[idx] || ShoppingBag
            return (
            <button key={category.name} className="text-center" type="button">
              <span className="mx-auto grid h-[54px] w-[54px] place-items-center rounded-full border border-[#6e8dc8]/25 bg-[#121f3f]">
                <Icon className="h-6 w-6 text-[#c4d3f2]" strokeWidth={2} />
              </span>
              <span className="mt-2 block text-[14px] text-[#c4d3f2]">{category.name}</span>
            </button>
          )})}
        </div>
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[17px] font-medium text-[#e3ebfb]">Best Sale</h3>
          <button className="text-[11px] text-[#8ea6d7]" type="button">
            VIEW ALL
          </button>
        </div>
        <ProductGrid items={products.slice(0, 2)} />
      </section>

      <section className="mt-5 pb-20">
        <h3 className="mb-3 text-[17px] font-medium text-[#e3ebfb]">All Products</h3>
        <ProductGrid items={products} />
      </section>
    </>
  )
}
