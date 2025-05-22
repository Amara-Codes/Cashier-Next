import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center px-24">
      <div className='flex justify-between items-center w-full mt-8'>
        <div className="logo-container">
          <Image
            src="/logo.png"
            alt="Logo"
            width={100}
            height={100}
            className="logo"
          />
        </div>
        <Button asChild>
          <Link href="/new-order">New Order</Link>
        </Button>
      </div>
      <div className="floor-wrapper flex w-full justify-between px-64 pt-16">
        <div className="floor-1 flex flex-col items-center justify-center w-1/2">
          <h2>Ground Floor</h2>


        </div>
        <div className="floor-2 flex flex-col items-center justify-center w-1/2">
          <h2>First Floor</h2>

        </div>
      </div>
    </main>
  )
}
