# Peta Risiko Banjir Kota Kediri

Situs web statis (HTML, CSS, JavaScript) yang menampilkan peta risiko banjir Kota Kediri dan mendeteksi apakah lokasi GPS pengguna berada di zona risiko **rendah**, **sedang**, atau **tinggi**.

## Struktur file

| File | Fungsi |
|---|---|
| `index.html` | Halaman utama |
| `style.css` | Tampilan |
| `script.js` | Peta, pemuatan data, dan deteksi GPS |
| `risiko-banjir.geojson` | Data zona risiko (data asli: 46 kelurahan, 16 tinggi, 14 sedang, 16 rendah) |

## Mengganti data dengan hasil pemetaan Anda

1. Ekspor layer risiko banjir dari QGIS/ArcGIS sebagai **GeoJSON** (sistem koordinat **EPSG:4326 / WGS84**).
2. Pastikan setiap fitur punya atribut:
   - `risiko`: `rendah`, `sedang`, atau `tinggi` (huruf kecil)
   - `nama`: nama zona/kelurahan (opsional)
   - `keterangan`: catatan tambahan (opsional)
3. Timpa file `risiko-banjir.geojson`.

Data yang disertakan memakai atribut `WADMKD` (nama kelurahan) dan `Kelas_Risk` (`Tinggi`/`Sedang`/`Rendah`); huruf besar/kecil tidak masalah. Jika nama atribut berbeda, ubah `KOLOM_RISIKO` di `script.js`.

## Sumber data

Peta risiko bencana banjir Kota Kediri oleh Novi Septiana Ramadani dan Delyla Fitria Hendik (SMA Dharma Wanita 1 Pare). Sumber: RBI, BIG, BPBD Kota Kediri.

## Menjalankan di komputer

Jangan membuka `index.html` dengan klik dua kali, karena `fetch` ke file GeoJSON akan diblokir browser. Gunakan server lokal, misalnya:

- ekstensi **Live Server** di VS Code, atau
- `python -m http.server 8000` lalu buka `http://localhost:8000`

## Menayangkan lewat GitHub Pages

1. Buat repository baru di GitHub, lalu unggah semua file di atas ke root repository.
2. Buka **Settings → Pages**.
3. Pada *Build and deployment*, pilih **Deploy from a branch**, branch `main`, folder `/ (root)`, lalu **Save**.
4. Tunggu beberapa menit; situs tersedia di `https://<username>.github.io/<nama-repo>/`.

GPS di browser hanya berfungsi lewat **HTTPS** (GitHub Pages sudah HTTPS) atau `localhost`.

## Catatan

- Akurasi GPS ponsel biasanya 5–30 m; di dalam gedung bisa lebih buruk. Aplikasi menampilkan akurasi, dan hasil di dekat batas zona bisa meleset.
- Bila zona saling tumpang tindih, sistem memakai zona dengan risiko tertinggi.
- Peta dasar memakai OpenStreetMap dan Leaflet.
