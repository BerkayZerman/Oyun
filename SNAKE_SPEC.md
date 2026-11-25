# Yılan (Snake) Oyunu — Uygulama Şartnamesi

## 0. Bağlam
- **Hedef:** Tarayıcıda bağımlılıksız çalışan basit bir Yılan oyunu.
- **Konum:** `C:\Users\berka\OneDrive\Masaüstü\Oyun`
- **Ortam:** Windows, git deposu yok, CDN / framework / backend yok.
- **Güvenlik:** Dosyalar oluşturulmadan önce dizin kontrol edilir. Mevcut `index.html`, `style.css` veya `game.js` varsa üzerine yazılmaz; kullanıcıya sorulur.

## 1. Kilitlenen kararlar
| Karar | Seçim |
|---|---|
| Yapı | 3 ayrı dosya: `index.html`, `style.css`, `game.js` + bu şartname |
| Teknoloji | Vanilla JavaScript + `<canvas>` |
| Görsel stil | Koyu tema, yuvarlatılmış köşeler, hafif gölge |
| Kapsam | Temel oyun + skor + `localStorage` en yüksek skor |
| Dışarıda | Hız artışı, duraklatma, mobil dokunmatik kontrol, ses, framework, backend |

## 2. Teknik şartname
- `GRID_SIZE = 20`, `CELL_SIZE = 20` → canvas `400 × 400` piksel.
- `TICK_MS = 120`; oyun döngüsü `requestAnimationFrame` + zaman biriktirme ile sabit adım atar. Bir karede en fazla `250 ms` sayılır (sekme arka plandayken sıçrama olmasın).
- Yön vektörleri: `UP (0,-1)`, `DOWN (0,1)`, `LEFT (-1,0)`, `RIGHT (1,0)`.
- Tuş eşlemesi: `ArrowUp`/`KeyW`, `ArrowDown`/`KeyS`, `ArrowLeft`/`KeyA`, `ArrowRight`/`KeyD`; `Enter`/`Space` yeniden başlatır (yalnızca oyun bittiyse).
- State: `snake` (dizi, baş indeks 0), `direction`, `pendingDirections` (en fazla 2), `food`, `score`, `highScore`, `gameOver`, `won`, `accumulator`, `lastTime`.
- Başlangıç yılanı: `[{x:10,y:10}, {x:9,y:10}, {x:8,y:10}]`, başlangıç yönü `RIGHT`.
- Fonksiyonlar: `init`, `reset`, `loop`, `step`, `draw`, `placeFood`, `queueDirection`, `endGame`, `handleKey`, `updateHUD`, `roundedRectPath`, `loadHighScore`, `saveHighScore`.
- `localStorage` anahtarı: `snakeHighScore`; okuma ve yazma `try/catch` içinde (tarayıcı engellerse oyun çalışmaya devam eder).
- `queueDirection`: aynı yöne veya son kuyruklanan yönün tersine izin vermez; aynı karede birden fazla tuş basılırsa ilk geçerli yön kazanır; kuyruk en fazla 2 yön tutar.
- Çarpışma: sınırların dışına çıkma veya gövdeye çarpma oyunu bitirir. Yem yenmiyorsa kuyruk hücresi kontrol dışı bırakılır (o adımda boşalacağı için yanlış çarpma olmaz).
- Yem, yılanın üzerinde olmayan hücrelerden rastgele seçilir. Tahta tamamen dolarsa `won = true` olur ve "Tebrikler!" ekranı gösterilir.
- Canvas `tabindex="0"` alır; ok tuşları ve boşluktuşunda sayfa kaydırması `preventDefault()` ile engellenir.
- Oyun bitti ekranı (başlık, final skor, yeniden başlat butonu) DOM overlay ile, oyun alanı canvas ile çizilir.

## 3. Kenar durumları
- Ters yöne anında dönüş engellenir.
- Aynı frame içinde birden fazla yön tuşu basılması güvenli kuyrukla çözülür.
- Yem asla yılanın gövdesine denk gelmez.
- `localStorage` kapalı/erişilemez olsa da oyun çalışır.
- Skor 0 iken rekor yazılmaz/güncellenmez.
- Oyun bittikten sonra yön tuşları hareket ettirmez; sadece `Enter`/`Space`/buton yeniden başlatır.
- Sekme arka plana alındığında birikmiş zaman `250 ms` ile sınırlandırılır.

## 4. Kabul senaryoları
1. Açılışta yılan 3 hücre, yem görünür, skor `0`, kayıtlı rekor varsa gösterilir.
2. Ok tuşları ve WASD yönü değiştirir; ters dönüş ve çift basış hatası olmaz.
3. Yem yendiğinde skor `+1` artar, yılan bir hücre uzar, yeni yem yılan dışında bir hücreye konur.
4. Duvara veya gövdeye çarpınca overlay görünür, skor korunur, rekor güncellenir.
5. Sayfa yenilendiğinde en yüksek skor korunur.
6. `Enter`, `Space` veya buton ile yeniden başlatınca yılan/skor sıfırlanır, overlay gizlenir, canvas odaklanır.
7. Tarayıcı konsolunda hata veya uyarı yoktur.

## 5. Doğrulama
`index.html` doğrudan tarayıcıda açılır; yukarıdaki 7 senaryo sırayla kontrol edilir. Ek olarak `game.js` için sözdizimi kontrolü yapılır.

## 6. Yapılmayacaklar (non-goals)
Hız artışı, duraklatma, mobil dokunmatik kontroller, ses efektleri, harici kütüphane, sunucu tarafı kayıt.
