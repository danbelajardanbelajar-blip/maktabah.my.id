import React from 'react';

const About: React.FC = () => {
  return (
    <div className="w-full bg-white p-6 md:p-10 rounded-2xl shadow-md text-slate-700 leading-relaxed my-4">
      <h2 className="text-2xl font-bold text-[#5d4037] mb-4 border-b pb-2">Tentang Kami</h2>
      <p className="mb-6">
        <strong>المكتبة السنية</strong> adalah perpustakaan digital Islam yang hadir untuk memudahkan umat dalam mengakses khazanah ilmu Islam, khususnya kitab-kitab dari para ulama salaf. Kami mengumpulkan, menata, dan menyajikan ribuan kitab dalam format digital yang mudah diakses oleh siapa saja, di mana saja, kapan saja — secara <em>gratis</em>.
      </p>

      <h2 className="text-xl font-bold text-[#5d4037] mb-3">Visi</h2>
      <p className="arabic text-xl text-right text-[#5d4037] mb-2 font-bold">"نشر العلم الشرعي وتيسيره للأمة"</p>
      <p className="mb-6">Menjadi portal terdepan dalam menyebarkan ilmu syar'i dan mempermudah akses umat Islam terhadap warisan intelektual para ulama.</p>

      <h2 className="text-xl font-bold text-[#5d4037] mb-3">Misi</h2>
      <ul className="list-disc pl-5 space-y-2 mb-8">
        <li>Menghadirkan kitab-kitab salaf yang otentik dan terpercaya.</li>
        <li>Mempermudah pencarian dan akses kitab secara digital.</li>
        <li>Mendukung para penuntut ilmu dengan koleksi yang terus berkembang.</li>
        <li>Menjaga warisan keilmuan Islam agar tetap lestari dan mudah diakses generasi mendatang.</li>
      </ul>

      <div className="bg-[#f4ebd0] rounded-2xl p-6 text-center mb-8 border border-[#d7ccc8]">
        <div className="arabic text-[#5d4037] text-2xl font-bold mb-2">طلب العلم فريضة على كل مسلم</div>
        <div className="text-[#795548] text-sm font-semibold">HR. Ibnu Mājah — Menuntut ilmu adalah kewajiban setiap Muslim</div>
      </div>

      <h2 className="text-xl font-bold text-[#5d4037] mb-4">Kontak & Akses</h2>
      <p className="mb-6">Anda dapat mengakses perpustakaan ini di: <a href="https://maktabah.my.id" className="text-amber-700 hover:underline font-medium">maktabah.my.id</a></p>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="border border-[#d7ccc8] rounded-xl p-5 bg-[#faf8f5]">
          <h3 className="font-bold text-[#795548] uppercase tracking-wider text-sm mb-4">Founder</h3>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between border-b border-[#e0e0e0] pb-2">
              <span className="text-gray-500">Nama</span>
              <span className="font-bold text-[#5d4037]">Cak Zen</span>
            </li>
            <li className="flex justify-between border-b border-[#e0e0e0] pb-2">
              <span className="text-gray-500">Email</span>
              <a href="mailto:akhmadzaeni535@gmail.com" className="font-bold text-[#5d4037] hover:text-amber-700">akhmadzaeni535@gmail.com</a>
            </li>
            <li className="flex justify-between pb-1">
              <span className="text-gray-500">Facebook</span>
              <a href="https://facebook.com/akhnadzaeni" target="_blank" rel="noopener noreferrer" className="font-bold text-[#5d4037] hover:text-amber-700">akhnadzaeni</a>
            </li>
          </ul>
        </div>

        <div className="border border-[#d7ccc8] rounded-xl p-5 bg-[#faf8f5]">
          <h3 className="font-bold text-[#795548] uppercase tracking-wider text-sm mb-4">Developer</h3>
          <ul className="space-y-3 text-sm">
            <li className="flex justify-between border-b border-[#e0e0e0] pb-2">
              <span className="text-gray-500">No Hp</span>
              <a href="https://wa.me/6285743399595" target="_blank" rel="noopener noreferrer" className="font-bold text-[#5d4037] hover:text-amber-700">085743399595</a>
            </li>
            <li className="flex justify-between border-b border-[#e0e0e0] pb-2">
              <span className="text-gray-500">Website</span>
              <a href="https://hakimz.site" target="_blank" rel="noopener noreferrer" className="font-bold text-[#5d4037] hover:text-amber-700">https://hakimz.site</a>
            </li>
            <li className="flex justify-between pb-1">
              <span className="text-gray-500">Instagram</span>
              <a href="https://instagram.com/zainul.hakim" target="_blank" rel="noopener noreferrer" className="font-bold text-[#5d4037] hover:text-amber-700">@zainul.hakim</a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default About;
