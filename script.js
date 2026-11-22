/* ============================================================
   Peta Risiko Banjir Kota Kediri
   - Menampilkan poligon risiko dari risiko-banjir.geojson
   - Mendeteksi posisi GPS pengguna dan menentukan zona risikonya
   ============================================================ */

const DATA_URL = "risiko-banjir.geojson";
const KEDIRI_CENTER = [-7.8167, 112.0117];

const WARNA = {
  rendah: "#2e9e4f",
  sedang: "#f1b21c",
  tinggi: "#d93b30",
};

const PESAN = {
  rendah: "Anda berada di zona risiko banjir RENDAH. Tetap waspada saat hujan deras.",
  sedang: "Anda berada di zona risiko banjir SEDANG. Pantau kondisi sungai dan saluran air saat hujan.",
  tinggi: "Anda berada di zona risiko banjir TINGGI. Siapkan rencana evakuasi dan hindari parkir di area rendah.",
};

/* ---------- Peta ---------- */
const map = L.map("map").setView(KEDIRI_CENTER, 13);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

let zonaFeatures = [];

// Membaca kelas risiko dari kolom "Kelas_Risk" (atau "kls_rawan"/"risiko"), tidak peduli huruf besar/kecil isinya.
const KOLOM_RISIKO = ["Kelas_Risk", "kelas_risk", "kls_rawan", "risiko"];
function ambilRisiko(props) {
  for (const k of KOLOM_RISIKO) {
    if (props && props[k] != null) return String(props[k]).trim().toLowerCase();
  }
  return "";
}

function gayaZona(feature) {
  const r = ambilRisiko(feature.properties);
  return {
    color: WARNA[r] || "#555",
    weight: 1.5,
    fillColor: WARNA[r] || "#999",
    fillOpacity: 0.45,
  };
}

async function muatData() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const geojson = await res.json();
    zonaFeatures = geojson.features;

    const layer = L.geoJSON(geojson, {
      style: gayaZona,
      onEachFeature: (feature, lyr) => {
        const p = feature.properties;
        lyr.bindPopup(
          `<strong>${p.WADMKD || p.nama || p.kelurahan || p.desa || "Zona"}</strong><br>Risiko: ${(ambilRisiko(p) || "-").toUpperCase()}` +
          (p.keterangan ? `<br>${p.keterangan}` : "")
        );
      },
    }).addTo(map);

    if (layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [20, 20] });
  } catch (err) {
    console.error(err);
    tampilkanStatus(
      "error",
      "Data peta gagal dimuat",
      "Pastikan file risiko-banjir.geojson ada, dan buka situs lewat server (Live Server / GitHub Pages), bukan klik dua kali file HTML."
    );
  }
}

/* ---------- Point-in-polygon ---------- */
// Ray casting untuk satu ring. Koordinat GeoJSON: [lng, lat]
function titikDalamRing(lng, lat, ring) {
  let dalam = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const memotong =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (memotong) dalam = !dalam;
  }
  return dalam;
}

// Poligon = ring luar + lubang (opsional)
function titikDalamPoligon(lng, lat, poligon) {
  if (!titikDalamRing(lng, lat, poligon[0])) return false;
  for (let k = 1; k < poligon.length; k++) {
    if (titikDalamRing(lng, lat, poligon[k])) return false; // di dalam lubang
  }
  return true;
}

function cariZona(lat, lng) {
  const urutan = { tinggi: 3, sedang: 2, rendah: 1 };
  let hasil = null;

  for (const f of zonaFeatures) {
    const g = f.geometry;
    if (!g) continue;
    const poligon =
      g.type === "Polygon" ? [g.coordinates] :
      g.type === "MultiPolygon" ? g.coordinates : [];

    const cocok = poligon.some((p) => titikDalamPoligon(lng, lat, p));
    if (!cocok) continue;

    const r = ambilRisiko(f.properties);
    // Bila zona tumpang tindih, ambil yang risikonya paling tinggi
    if (!hasil || (urutan[r] || 0) > (urutan[hasil.risiko] || 0)) {
      const p = f.properties;
      hasil = { risiko: r, nama: p.WADMKD || p.nama || p.kelurahan || p.desa, keterangan: p.keterangan };
    }
  }
  return hasil;
}

/* ---------- Panel status ---------- */
const elStatus = document.getElementById("status");
const elText = document.getElementById("status-text");
const elDetail = document.getElementById("status-detail");

function tampilkanStatus(kelas, judul, detail) {
  elStatus.className = "status status-" + kelas;
  elText.textContent = judul;
  elDetail.textContent = detail;
}

/* ---------- GPS ---------- */
const btnLocate = document.getElementById("btn-locate");
const btnStop = document.getElementById("btn-stop");

let watchId = null;
let markerPengguna = null;
let lingkarAkurasi = null;
let risikoSebelumnya = null;
let sudahZoom = false;

const ikonPengguna = L.divIcon({
  className: "",
  html: '<div class="pulse-marker"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function mulaiLacak() {
  if (!("geolocation" in navigator)) {
    tampilkanStatus("error", "GPS tidak didukung", "Browser Anda tidak mendukung geolokasi.");
    return;
  }

  tampilkanStatus("idle", "Mencari lokasi…", "Izinkan akses lokasi bila browser meminta.");
  btnLocate.hidden = true;
  btnStop.hidden = false;

  watchId = navigator.geolocation.watchPosition(onPosisi, onGalat, {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 20000,
  });
}

function berhentiLacak() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  sudahZoom = false;
  risikoSebelumnya = null;
  if (markerPengguna) { map.removeLayer(markerPengguna); markerPengguna = null; }
  if (lingkarAkurasi) { map.removeLayer(lingkarAkurasi); lingkarAkurasi = null; }
  btnLocate.hidden = false;
  btnStop.hidden = true;
  tampilkanStatus("idle", "Belum dilacak", "Tekan tombol di bawah untuk mendeteksi lokasi Anda.");
}

function onPosisi(pos) {
  const { latitude: lat, longitude: lng, accuracy } = pos.coords;
  const latlng = [lat, lng];

  if (!markerPengguna) {
    markerPengguna = L.marker(latlng, { icon: ikonPengguna }).addTo(map);
    lingkarAkurasi = L.circle(latlng, { radius: accuracy, color: "#1a73e8", weight: 1, fillOpacity: 0.1 }).addTo(map);
  } else {
    markerPengguna.setLatLng(latlng);
    lingkarAkurasi.setLatLng(latlng).setRadius(accuracy);
  }

  if (!sudahZoom) { map.setView(latlng, 16); sudahZoom = true; }

  const zona = cariZona(lat, lng);
  const catatanAkurasi = ` (akurasi GPS ±${Math.round(accuracy)} m${accuracy > 50 ? " — kurang presisi, hasil bisa meleset" : ""})`;

  if (zona && PESAN[zona.risiko]) {
    const nama = zona.nama ? `${zona.nama}. ` : "";
    tampilkanStatus(zona.risiko, "Risiko " + zona.risiko.toUpperCase(), nama + PESAN[zona.risiko] + catatanAkurasi);

    if (risikoSebelumnya !== zona.risiko) {
      if (zona.risiko === "tinggi" && navigator.vibrate) navigator.vibrate([200, 100, 200]);
      risikoSebelumnya = zona.risiko;
    }
  } else {
    tampilkanStatus("luar", "Di luar area terpetakan", "Lokasi Anda tidak berada di zona yang sudah dipetakan." + catatanAkurasi);
    risikoSebelumnya = null;
  }
}

function onGalat(err) {
  const pesan = {
    1: "Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan browser lalu coba lagi.",
    2: "Posisi tidak tersedia. Pastikan GPS/lokasi perangkat aktif.",
    3: "Waktu pencarian lokasi habis. Coba lagi di tempat yang sinyalnya lebih baik.",
  };
  tampilkanStatus("error", "Gagal mendeteksi lokasi", pesan[err.code] || err.message);
  if (err.code === 1) berhentiLacak();
}

btnLocate.addEventListener("click", mulaiLacak);
btnStop.addEventListener("click", berhentiLacak);

muatData();
