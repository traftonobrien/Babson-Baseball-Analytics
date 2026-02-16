import Link from "next/link";
import Image from "next/image";

export default function Header() {
  return (
    <header className="bg-zinc-900/80 backdrop-blur-sm border-b border-zinc-800 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 py-2.5 w-fit group transition-opacity hover:opacity-80"
        >
          <Image
            src="/babson-logo.svg"
            alt="Babson College"
            width={36}
            height={36}
            className="shrink-0"
            priority
          />
          <span className="text-sm sm:text-base font-semibold tracking-tight text-zinc-100">
            Babson Baseball Pitching Portal
          </span>
        </Link>
      </div>
    </header>
  );
}
