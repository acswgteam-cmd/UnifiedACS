# UnifiedACS → ChatGPT (baca + input artwork)

Kode ini menambahkan MCP Streamable HTTP di `/api/mcp` ke proyek Vite/Vercel yang ada. ChatGPT dapat membaca data Supabase melalui fungsi baca dan input artwork. Tidak memerlukan Gemini atau OpenAI API key. Koneksi GitHub sendiri tidak memberi akses ke database aplikasi.

**Versi 1.1:** menambahkan `list_designers`, `create_artwork`, dan waktu input artwork (`created_at`). Fungsi baca tetap memakai transaksi READ ONLY. Input hanya menambah artwork dalam proyek yang sudah ada, dengan PIC aktif, tanpa UPDATE/DELETE. Token baca lama tetap dapat membaca; pembuatan artwork membutuhkan scope tambahan `acs:artwork:create`.

## Aktivasi pembaruan untuk koneksi yang sudah terpasang

1. Jalankan `supabase/mcp/setup_artwork_writer.sql` pada database yang sama. Script tidak mengganti password, frontend grants, atau konfigurasi RLS aplikasi lama. Audit input berada di schema privat dengan RLS aktif. Default transaksi login tetap read-only; fungsi input membuka READ WRITE secara eksplisit.
2. Deploy kode versi 1.1 pada branch connector yang dipakai (`feat/read-only-mcp`). URL, issuer, audience, allowlist dan database URL tetap sama.
3. Di Auth0 → Applications → APIs → API UnifiedACS dengan Identifier sesuai `MCP_RESOURCE_URL` → Permissions, tambahkan `acs:artwork:create` dengan deskripsi “Add artwork to existing ACS projects”. Bila API menggunakan RBAC, berikan permission ini hanya kepada akun HOD yang diizinkan, serta `acs:read`. Server tetap memeriksa `MCP_ALLOWED_SUBJECTS`.
4. Refresh daftar tools dan lakukan login/otorisasi ulang koneksi UnifiedACS di ChatGPT agar token mendapat kedua scope. Token tanpa scope tulis akan ditolak saat membuat artwork. Metadata discovery mengiklankan kedua scope.
5. Coba instruksi: “Tambahkan artwork [nama] di project [nama], tipe 2D Design, PIC Sofyan, mulai 7 Oktober 2026.” Tanggal selesai opsional; jumlah revisi default 0, approval default false, catatan opsional. Assistant mencari ID proyek/PIC terlebih dahulu, dan meminta klarifikasi bila ambigu.
6. Jalankan `supabase/mcp/verify_artwork_writer.sql`. `can_update`, `can_delete`, `can_forge_input_time` harus false. Script verifikasi read-only lama tidak berlaku lagi untuk login yang diperbarui.

`request_id` berupa UUID menjadi ID artwork sekaligus kunci retry. Gunakan ID dan argumen yang sama saat retry; pergantian payload atau pemilik pada ID yang sama ditolak. INSERT artwork dan audit input dilakukan atomik. Audit menyimpan subject OAuth terverifikasi, hash input, receipt dan waktu input. Pengulangan mengembalikan receipt awal dan `replayed: true`; receipt bukan status terbaru setelah pengguna mengedit artwork melalui aplikasi.

**Keamanan:** setup membatasi login connector melalui grant kolom dan trigger khusus untuk memastikan input selalu PROJECT dengan PIC aktif dan nilai valid. Schema audit bersifat privat dan memakai RLS. Perubahan model autentikasi/RLS frontend berada di luar scope connector ini; tinjau kebijakan aplikasi sebelum mengubahnya.

**Validasi:** test MCP menggunakan token RS256 lokal dan database simulasi; jalankan ulang tests/typecheck/build. Status deployment, permission database dan scope OAuth harus diperiksa terpisah. Jangan menganggap test lokal sebagai bukti input melalui ChatGPT sudah aktif.

## Data yang tersedia

| Fungsi | Pertanyaan | Sumber |
| --- | --- | --- |
| `list_designers` | “Cari Sofyan dan ID PIC aktif” | designers |
| `create_artwork` | “Tambahkan artwork ke proyek” | artwork_logs + audit privat |
| `search_projects` | “Cari proyek X / proyek yang ON PROGRESS” | projects + designers |
| `get_project_details` | “Siapa PIC, kapan mulai/selesai, apa checklist dan artwork proyek ini?” | projects + designers + project_checklists + artwork_logs |
| `list_internal_tasks` | “Apa pekerjaan internal yang deadline minggu ini?” | internal_designs + departments |
| `get_task_updates` | “Apa update terbaru dan PIC catatan tugas ini?” | internal_design_changelog + internal_designs + departments + designers |

Gunakan pencarian dahulu, lalu ID dari hasilnya. Nama mirip perlu dikonfirmasi kepada pengguna. PIC proyek, designer artwork, requester tugas, dan PIC catatan adalah peran berbeda. Task internal belum mempunyai kolom PIC tingkat task; connector tidak menebaknya. Label `changed_by` di aplikasi lama bukan identitas pengguna terverifikasi. Riwayat lama mungkin tidak lengkap. `retrieved_at` adalah waktu pembacaan; `artwork.created_at` adalah waktu input; start_date/end_date adalah tanggal pengerjaan.

Survey, evaluasi designer, lead, URL gambar, dan link Drive tidak diekspos. Brief dan catatan proyek tidak diambil; isi catatan dan nilai perubahan yang tercatat di changelog tetap dapat dibaca. Semua teks dianggap data tidak tepercaya, bukan instruksi AI. Hasil maksimal 50 baris per daftar, dengan `has_more`/`next_offset`, bukan total jumlah data. Detail proyek memiliki pagination terpisah untuk checklist dan artwork dengan offset yang sama. String panjang dibatasi 4.000 karakter.

## 1. Siapkan akun database khusus baca

1. Di Supabase, pastikan tabel aplikasi dan migrasi changelog yang sudah ada telah dipasang (termasuk `note_title`, `note_deadline`, `note_status`, `pic_designer_id`). Struktur produksi belum dapat diverifikasi dari GitHub.
2. Buka **SQL Editor**. Jalankan `supabase/mcp/setup_readonly.sql` sekali. Script membuat dua role khusus, memberi SELECT hanya pada kolom yang dipakai, dan menambahkan kebijakan SELECT untuk role tersebut. Script tidak mengganti kebijakan frontend. Seluruh setup dibatalkan jika tabel/kolom hilang atau grant PUBLIC memberi hak tulis/akses tabel lain. Jangan jalankan ulang jika role telah ada; periksa hasil terlebih dahulu.
3. Buat password acak panjang untuk role baru, lalu jalankan secara pribadi di SQL Editor:

   ```sql
   ALTER ROLE acs_mcp_login LOGIN PASSWORD '<PASSWORD_BARU_PRIBADI>';
   ```

4. Dari **Connect → Transaction pooler**, salin host/port yang ditampilkan. Ganti username `postgres.PROJECTREF` menjadi `acs_mcp_login.PROJECTREF`, dan password dengan password role baru. Percent-encode karakter khusus pada password. Jangan gunakan password `postgres`, anon key, atau service-role key.
5. Simpan connection string tersebut hanya di Vercel sebagai `MCP_DATABASE_URL`. Jangan kirim password ke chat atau commit. Hapus parameter `sslmode`, `sslcert`, dan parameter SSL lainnya dari URL: TLS ditetapkan oleh kode dan selalu memverifikasi sertifikat. Bila CA khusus dibutuhkan, isi `MCP_DATABASE_CA` dengan sertifikat CA resmi Supabase.

Role ini ditujukan untuk akses HOD ke seluruh baris dalam tujuh tabel tersebut, bukan isolasi antarpegawai/tenant. Jangan menambah user ke allowlist bila ia tidak boleh membaca seluruh data tersebut. Setup tidak memperbaiki keamanan frontend lama; akses admin/frontend tanpa login dan kebijakan RLS yang terlalu luas tetap perlu ditangani terpisah.

## 2. Siapkan OAuth (contoh: Auth0)

Gunakan penyedia OAuth yang sudah tersedia bila kompatibel dengan MCP. Implementasi ini memverifikasi JWT **RS256** lewat JWKS dan tidak membuat sistem login sendiri. Berikut konfigurasi Auth0 yang sesuai:

1. Buat tenant Auth0 dan API dengan **Identifier** persis URL endpoint yang digunakan, misalnya `https://unified-acs.vercel.app/api/mcp`. Gunakan signing algorithm RS256 dan tambahkan permission/scope `acs:read`.
2. Aktifkan **Resource Parameter Compatibility Profile** untuk pemetaan parameter MCP `resource` ke audience API. Pastikan penyedia mendukung discovery OAuth, authorization code + PKCE, serta CIMD atau Dynamic Client Registration (DCR). Ikuti panduan Auth0 MCP yang ditautkan di bagian referensi; opsi dashboard bisa berubah.
3. Buat/undang akun Sofyan dan aktifkan MFA. Catat `user_id` dari profil akun tersebut (misalnya `auth0|...`) sebagai `MCP_ALLOWED_SUBJECTS`. ID ini harus sama persis dengan claim `sub` pada access token. Server tidak menggunakan email sebagai identitas.
4. Gunakan issuer dari metadata penyedia (biasanya `https://TENANT.auth0.com/`) dan JWKS URL-nya. Token harus mempunyai issuer, audience endpoint, `exp`, `iat`, `sub`, serta `scope` yang memuat `acs:read`. Jangan menggunakan ID token sebagai access token.
5. Untuk penyedia yang belum mendukung CIMD, aktifkan DCR atau daftarkan OAuth client ChatGPT sesuai panduan penyedia dan UI koneksi. Jika memakai client terdaftar, set callback persis yang diberikan ChatGPT, bukan URL tebakan. Client secret, bila diminta UI OAuth, dimasukkan langsung ke konfigurasi koneksi; server ini tidak membutuhkan client secret.

## 3. Isi Vercel environment variable

Environment variable frontend yang sudah ada tetap digunakan oleh aplikasi. Tambahkan variabel **tanpa awalan `VITE_`** berikut ke deployment connector:

| Nama | Nilai |
| --- | --- |
| `MCP_RESOURCE_URL` | URL HTTPS lengkap endpoint, contoh `https://unified-acs.vercel.app/api/mcp` |
| `MCP_OAUTH_ISSUER` | Issuer OAuth persis dari metadata, termasuk trailing slash bila ada |
| `MCP_OAUTH_JWKS_URL` | URL HTTPS JWKS dari penyedia |
| `MCP_ALLOWED_SUBJECTS` | ID akun owner; beberapa ID dipisahkan koma |
| `MCP_DATABASE_URL` | Connection string akun `acs_mcp_login`, khusus server |
| `MCP_DATABASE_CA` | Opsional, PEM CA database resmi |

Untuk preview/staging gunakan hostname staging yang stabil sebagai resource/audience tersendiri, tenant/client yang sesuai, serta database uji. Jangan menambahkan rahasia produksi ke preview branch yang tidak dipercaya. Vercel Deployment Protection dapat menghalangi discovery ChatGPT; gunakan staging yang endpoint-nya dapat dijangkau HTTPS dan tetap dilindungi OAuth. Jangan mengatasi hal tersebut dengan mematikan autentikasi connector.

Pastikan runtime Vercel Node.js 22 atau lebih baru. Redeploy diperlukan setelah environment variable berubah. `npm run dev` hanya menjalankan Vite frontend; untuk fungsi `/api` lokal gunakan `vercel dev` dengan konfigurasi development pribadi. `npm run build` memverifikasi frontend, bukan deployment serverless.

## 4. Periksa staging sebelum merge

Jalankan lokal:

```sh
npm ci --ignore-scripts
npm run test:mcp
npm run typecheck
npm run build
```

Tests menggunakan token RS256 yang ditandatangani lokal dan database simulasi; tidak menulis atau membaca data produksi. Tests menguji token salah/expired, allowlist, scope, konfigurasi gagal tertutup, validasi/pagination, parameter SQL, pemisahan PIC, penghapusan metadata riwayat dari teks, dan alur HTTP MCP.

Setelah deploy staging:

1. `GET /.well-known/oauth-protected-resource` harus mengembalikan resource, issuer, dan scope `acs:read` dan `acs:artwork:create` yang benar. Endpoint discovery tidak berisi rahasia/data proyek.
2. `POST /api/mcp` tanpa token harus menghasilkan `401` dan header `WWW-Authenticate`. Sebelum semua konfigurasi diisi, `503` adalah normal.
3. Dari **MCP Inspector** atau ChatGPT, login sebagai owner. Uji keempat fungsi dengan satu proyek dan task yang diketahui. Bandingkan PIC, tanggal, status dan update dengan UI/Supabase; ulangi dengan nama ambigu, hasil kosong dan daftar yang lebih panjang dari limit.
4. Login akun lain yang tidak di-allowlist harus ditolak. Token untuk audience lain atau tanpa `acs:read` juga harus ditolak.
5. Jalankan `supabase/mcp/verify_readonly.sql` di SQL Editor. Hasil hak tulis dan akses tabel di luar scope harus kosong. Jalankan pemeriksaan ini lagi bila privilege database berubah.
6. Di Vercel, pastikan fungsi `/api/mcp` terdeteksi dan log tidak menyimpan bearer token, password, atau hasil data. Aktifkan pembatasan laju di Vercel Firewall sesuai traffic yang diperlukan. Hindari terlalu banyak koneksi database: pool kode maksimal dua koneksi per instance, role maksimal lima; sesuaikan kapasitas bila konkurensi bertambah.

## 5. Hubungkan ChatGPT

Setelah staging berhasil dan perubahan disetujui/di-merge:

1. Redeploy produksi dengan konfigurasi produksi.
2. Aktifkan **Developer mode** di pengaturan ChatGPT bila tersedia untuk akun/workspace.
3. Buat custom MCP app/plugin dengan URL `https://unified-acs.vercel.app/api/mcp` dan **OAuth**. Login memakai akun yang ada dalam allowlist. Jangan memilih No Authentication untuk data internal.
4. Buka chat baru, aktifkan koneksi UnifiedACS, lalu coba:
   - “Cari proyek [nama]. Siapa PIC utama dan siapa support-nya?”
   - “Tanggal mulai dan selesai proyek tersebut kapan?”
   - “Daftar pekerjaan internal dengan deadline 2026-10-01 sampai 2026-10-07.”
   - “Tampilkan lima update terbaru untuk tugas [nama].”

Ketersediaan custom MCP dan lokasi pengaturan bergantung akun serta kebijakan workspace. Ini koneksi baru untuk data aplikasi; GitHub tetap koneksi yang berbeda untuk kode.

## Penonaktifan

Untuk menutup akses ChatGPT, kosongkan `MCP_ALLOWED_SUBJECTS` dan redeploy, atau nonaktifkan endpoint deployment. Untuk menutup akun database, jalankan `ALTER ROLE acs_mcp_login NOLOGIN;` dan hentikan koneksi aktif bila diperlukan. Hapus koneksi ChatGPT/revoke consent di penyedia OAuth. Menghapus user dari allowlist efektif pada request berikut setelah deployment konfigurasi baru.

## Referensi resmi

- [OpenAI: autentikasi MCP](https://developers.openai.com/plugins/build/auth)
- [OpenAI: menghubungkan dan menguji di ChatGPT](https://developers.openai.com/plugins/deploy/connect-chatgpt)
- [Auth0: Auth for MCP](https://auth0.com/blog/auth0-auth-for-mcp-servers-generally-available/)
- [Auth0: Dynamic Client Registration](https://auth0.com/docs/get-started/applications/dynamic-client-registration)
- [Supabase: koneksi Postgres dan shared pooler](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase: Postgres roles](https://supabase.com/docs/guides/database/postgres/roles)
- [MCP SDK: stateless Streamable HTTP](https://ts.sdk.modelcontextprotocol.io/server)
