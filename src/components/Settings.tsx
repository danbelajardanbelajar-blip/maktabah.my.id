import React from 'react';

export const THEMES = [
  { id: 'light', name: 'Terang (Modern)', bg: '#f8fafc', text: '#1e293b', readerBg: '#f1f5f9', readerPaper: '#ffffff', primary: '#0f172a', primaryHover: '#1e293b' },
  { id: 'sepia', name: 'Krem (Elegan)', bg: '#fff7ed', text: '#431407', readerBg: '#fff7ed', readerPaper: '#ffedd5', primary: '#9a3412', primaryHover: '#7c2d12' },
  { id: 'green', name: 'Zamrud (Islami)', bg: '#f0fdf4', text: '#064e3b', readerBg: '#ecfdf5', readerPaper: '#dcfce7', primary: '#059669', primaryHover: '#047857' },
  { id: 'dark', name: 'Malam (Nyaman)', bg: '#0f172a', text: '#f8fafc', readerBg: '#020617', readerPaper: '#1e293b', primary: '#3b82f6', primaryHover: '#2563eb' }
];

export const ARABIC_FONTS = [
  { id: 'Amiri', name: 'Amiri (Klasik Kitab)' },
  { id: 'Lateef', name: 'Lateef (Luwes)' },
  { id: 'Scheherazade New', name: 'Scheherazade (Jelas)' }
];

export const LATIN_FONTS = [
  { id: 'Inter', name: 'Inter (Modern)' },
  { id: 'Merriweather', name: 'Merriweather (Klasik)' },
  { id: 'Roboto', name: 'Roboto (Standar)' }
];

interface SettingsProps {
  settings: any;
  setSettings: (s: any) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, setSettings }) => {
  const handleChange = (key: string, value: any) => {
    setSettings({ ...settings, [key]: value });
  };

  return (
    <div className="bg-white p-6 md:p-10 rounded-xl shadow-lg border border-[#d7ccc8] w-full my-4">
      <h2 className="text-3xl font-bold mb-8 text-center text-[#4e342e]">⚙️ Pengaturan Tampilan</h2>
      
      <div className="space-y-8">
        {/* Tema / Warna Background */}
        <div>
          <h3 className="text-xl font-bold mb-4 border-b pb-2">Tema & Warna Latar</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {THEMES.map(theme => (
              <button
                key={theme.id}
                onClick={() => handleChange('theme', theme.id)}
                className={`p-4 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-2 ${
                  settings.theme === theme.id ? 'border-blue-500 shadow-md transform scale-105' : 'border-gray-200 hover:border-blue-300'
                }`}
                style={{ backgroundColor: theme.bg, color: theme.text }}
              >
                <div className="w-8 h-8 rounded-full border border-black/20" style={{ backgroundColor: theme.readerPaper }}></div>
                <span className="font-bold text-center text-sm">{theme.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Font Arab */}
        <div>
          <h3 className="text-xl font-bold mb-4 border-b pb-2">Jenis Huruf (Font) Arab</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ARABIC_FONTS.map(font => (
              <button
                key={font.id}
                onClick={() => handleChange('arabicFont', font.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  settings.arabicFont === font.id ? 'border-blue-500 shadow-md bg-blue-50' : 'border-gray-200 hover:border-blue-300 bg-white'
                }`}
              >
                <div style={{ fontFamily: font.id }} className="text-3xl mb-2 text-center text-gray-800">
                  بسم الله الرحمن الرحيم
                </div>
                <div className="text-center font-bold text-sm text-gray-700">{font.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Font Latin */}
        <div>
          <h3 className="text-xl font-bold mb-4 border-b pb-2">Jenis Huruf (Font) Latin</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {LATIN_FONTS.map(font => (
              <button
                key={font.id}
                onClick={() => handleChange('latinFont', font.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  settings.latinFont === font.id ? 'border-blue-500 shadow-md bg-blue-50' : 'border-gray-200 hover:border-blue-300 bg-white'
                }`}
              >
                <div style={{ fontFamily: font.id }} className="text-xl mb-2 text-center text-gray-800">
                  Teks Latin
                </div>
                <div className="text-center font-bold text-sm text-gray-700">{font.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Ukuran Font Reader */}
        <div>
          <h3 className="text-xl font-bold mb-4 border-b pb-2">Ukuran Font Default (Baca Kitab)</h3>
          <div className="flex items-center gap-6 bg-gray-50 p-6 rounded-lg border border-gray-200">
            <button 
              onClick={() => handleChange('fontSize', Math.max(16, settings.fontSize - 2))}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 w-12 h-12 rounded-full font-bold text-xl flex items-center justify-center"
            >
              A-
            </button>
            <div className="flex-1 text-center">
              <span className="text-3xl font-bold text-gray-800">{settings.fontSize} px</span>
              <p className="text-sm text-gray-500 mt-2">Ukuran ini akan dipakai setiap kali Anda membuka kitab.</p>
            </div>
            <button 
              onClick={() => handleChange('fontSize', Math.min(48, settings.fontSize + 2))}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 w-12 h-12 rounded-full font-bold text-xl flex items-center justify-center"
            >
              A+
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Settings;



