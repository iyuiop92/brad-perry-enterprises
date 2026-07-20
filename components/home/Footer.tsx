import Image from 'next/image'

export default function Footer() {
  return (
    <footer className="py-12 px-6 border-t border-[rgba(0,180,255,0.07)]">
      <div className="max-w-6xl mx-auto flex flex-col items-center gap-6">
        <Image
          src="/bpe-logo.png"
          alt="Brad Perry Enterprises"
          width={140}
          height={140}
          className="opacity-40 invert"
          priority={false}
        />
        <div className="w-full flex items-center justify-between flex-wrap gap-4 pt-2">
          <span className="text-white text-sm">
            &copy; 2025 Brad Perry Enterprises. All rights reserved.
          </span>
          <div className="flex items-center gap-5">
            <a
              href="mailto:hello@bradperryenterprises.com"
              className="text-white text-sm hover:text-white transition-colors"
            >
              hello@bradperryenterprises.com
            </a>
            <a
              href="/login"
              className="text-[10px] font-[600] text-white border border-[rgba(0,180,255,0.08)] px-3 py-1.5 rounded-lg hover:border-[rgba(0,180,255,0.25)] hover:text-white transition-all"
            >
              Admin
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
