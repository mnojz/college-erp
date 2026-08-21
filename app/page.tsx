import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-col items-center justify-between p-24">
      <h1 className=" text-center text-6xl mt-25">hello world</h1>
      <Link href="/pritam" className="mt-52 bg-blue-500 fill-white text-3xl px-4 py-2 rounded-2xl hover:bg-blue-600">pritam</Link>
    </main>
  );
}
