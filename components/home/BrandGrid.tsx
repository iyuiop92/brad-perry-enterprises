import Image from 'next/image'

const brands = [
  { name: 'Mipura', initials: 'M', color: '#c17f3c', logo: '/logos/2.png' },
  { name: 'StartPaddle', initials: 'SP', color: '#0ea5e9', logo: '/logos/brand-logos.png' },
  { name: 'StudioThree60', initials: 'S3', color: '#8b5cf6', logo: '/logos/4.png' },
  { name: 'PetProsUSA', initials: 'PP', color: '#22c55e', logo: null },
  { name: 'SuperWatchesStore', initials: 'SW', color: '#f59e0b', logo: '/logos/brand-logos-4.png' },
  { name: 'AetherHockey', initials: 'AH', color: '#00b4ff', logo: '/logos/1.png' },
  { name: 'AZ Ice', initials: 'AZ', color: '#94a3b8', logo: '/logos/azice-daysmart-logo-3.png' },
  { name: 'DrivenBaseball', initials: 'DB', color: '#ef4444', logo: '/logos/dba-logo-dark.png' },
]

export default function BrandGrid() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto grid grid-cols-4 gap-y-10 gap-x-6">
        {brands.map((brand) => (
          <div key={brand.name} className="flex flex-col items-center gap-3 group">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center font-[800] text-sm transition-transform duration-200 group-hover:scale-110 overflow-hidden"
              style={{
                backgroundColor: brand.logo ? '#fff' : brand.color + '18',
                border: `1.5px solid ${brand.color}40`,
                color: brand.color,
              }}
            >
              {brand.logo ? (
                <Image
                  src={brand.logo}
                  alt={brand.name}
                  width={64}
                  height={64}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                brand.initials
              )}
            </div>
            <span className="text-[#475569] text-xs text-center leading-tight group-hover:text-[#64748b] transition-colors">
              {brand.name}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
