import Image from 'next/image'

const brands = [
  { name: 'Mipura', initials: 'M', color: '#c17f3c', logo: '/logos/mipura.png', url: 'https://mipura.com' },
  { name: 'StartPaddle', initials: 'SP', color: '#0ea5e9', logo: '/logos/brand-logos.png', url: 'https://startpaddle.com' },
  { name: 'StudioThree60', initials: 'S3', color: '#8b5cf6', logo: '/logos/studiothree60.png', url: 'https://studiothree60.com' },
  { name: 'PetProsUSA', initials: 'PP', color: '#22c55e', logo: '/logos/petprosusa.png', url: 'https://bradperryenterprises.com' },
  { name: 'SuperWatches', initials: 'SW', color: '#f59e0b', logo: '/logos/brand-logos-4.png', url: 'https://bradperryenterprises.com' },
  { name: 'AetherHockey', initials: 'AH', color: '#00b4ff', logo: '/logos/aetherhockey.png', url: 'https://aetherhockey.com' },
]

export default function BrandGrid() {
  return (
    <section className="py-16 px-6">
      <div className="max-w-4xl mx-auto grid grid-cols-3 sm:grid-cols-6 gap-y-10 gap-x-4">
        {brands.map((brand) => (
          <a
            key={brand.name}
            href={brand.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-3 group"
          >
            <div className="w-16 h-16 flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
              {brand.logo ? (
                <Image
                  src={brand.logo}
                  alt={brand.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span
                  className="font-[800] text-base"
                  style={{ color: brand.color }}
                >
                  {brand.initials}
                </span>
              )}
            </div>
            <span className="text-[#475569] text-xs text-center leading-tight group-hover:text-[#64748b] transition-colors">
              {brand.name}
            </span>
          </a>
        ))}
      </div>
    </section>
  )
}
