# Yılan (Snake) Oyunu — Uygulama Şartnamesi

## 0. Bağlam
- **Hedef:** Tarayıcıda bağımlılıksız çalışan, premium arcade kabin görünümlü Yılan oyunu.
- **Konum:** `C:\Users\berka\OneDrive\Masaüstü\Oyun`
- **Ortam:** Windows, git deposu mevcut, CDN / framework / backend yok.
- **Güvenlik:** Mevcut dosyalar kullanıcı onayı olmadan silinmez; `localStorage` erişimi her zaman `try/catch` içindedir.

## 1. Kilitlenen kararlar
| Karar | Seçim |
|---|---|
| Yapı | 3 ayrı dosya: `index.html`, `style.css`, `game.js` + bu şartname |
| Teknoloji | Vanilla JavaScript + `<canvas>` + WebAudio (harici dosya yok) |
| Görsel stil | Premium arcade kabin: fırçalanmış metal/ahşap kasa, neon marquee, cam ekran, scanline, yeşil fosfor ızgara, 3D görünümlü yılan ve meyve |
| Kapsam | Temel oyun + skor + `localStorage` en yüksek skor + duraklatma + dokunmatik yön tuşları + sessize alınabilir ses efektleri |
| Dışarıda | Hız artışı, framework, backend, harici ses/görsel dosyası, kaydırma (swipe) hareketi |

## 2. Teknik şartname
- `GRID_SIZE = 20`, `CELL_SIZE = 20` → canvas `400 × 400` piksel (CSS ile ölçeklenir).
- `TICK_MS = 120`; oyun döngüsü `requestAnimationFrame` + zaman biriktirme ile sabit adım atar. Bir karede en fazla `250 ms` sayılır.
- Yön vektörleri: `UP (0,-1)`, `DOWN (0,1)`, `LEFT (-1,0)`, `RIGHT (1,0)`.
- Tuş eşlemesi: ok tuşları / WASD yön verir; `KeyP` duraklatır/devam eder; `Enter`/`Space` yalnızca oyun bittiyse yeniden başlatır. Buton odaktayken Enter/Space yerel tıklamaya bırakılır.
- State: `snake`, `direction`, `pendingDirections` (en fazla 2), `food`, `score`, `highScore`, `gameOver`, `won`, `paused`, `hasStarted`, `accumulator`, `lastTime`, `eatPulse`, `soundEnabled`, `audioContext`, `backgroundLayer`, `bodySprite`, `headSprite`.
- `localStorage` anahtarları: `snakeHighScore`, `snakeSoundEnabled`; tüm okuma/yazmalar `try/catch` içinde.
- `queueDirection`: aynı yöne veya son kuyruklanan yönün tersine izin vermez; kuyruk en fazla 2 yön tutar. Duraklatılmışken yön alınmaz.
- `togglePause`: oyun bittiyse etkisizdir; `paused` değerini çevirir, duraklatma ekranını ve buton durumunu günceller. Devam ederken birikmiş zaman sıfırlanır.
- Çarpışma: sınırların dışına çıkma veya gövdeye çarpma oyunu bitirir. Yem yenmiyorsa kuyruk hücresi kontrol dışı bırakılır.
- Yem, yılanın üzerinde olmayan hücrelerden rastgele seçilir. Tahta dolarsa `won = true` olur ve "Tebrikler!" ekranı gösterilir.
- Çizim: statik zemin (doku + ızgara + vignette) bir kez `createBackground()` ile offscreen canvas'a çizilir; yılan gövdesi/başı `createBodySprite()` / `createHeadSprite()` sprite'larıyla çizilir. `draw()` her karede arka planı kopyalar, yemeği radyal gradyanla, yılanı birleşik halkalar + göz + dil ile çizer.
- Ses: `ensureAudio()` ilk kullanıcı etkileşiminde `AudioContext` oluşturur; `playTone()` oscillator + gain ile kısa ton üretir. Yem ve çarpma tonları vardır. Ses kapalıyken hiçbir ses düğümü oluşturulmaz.
- D-pad: `pointerdown` ile anında yön verir; klavye ile oluşan `click` (`event.detail === 0`) de aynı yönü kuyruklar. `touch-action: manipulation` ile çift dokunma kaydırması engellenir.
- Canvas `tabindex="0"` alır; ok tuşları ve boşluktuşunda sayfa kaydırması `preventDefault()` ile engellenir.

## 3. Kenar durumları
- Ters yöne anında dönüş engellenir.
- Aynı frame içinde birden fazla yön tuşu basılması güvenli kuyrukla çözülür.
- Yem asla yılanın gövdesine denk gelmez.
- `localStorage` kapalı/erişilemez olsa da oyun ve ses tercihi oturum içinde çalışır.
- Skor 0 iken rekor yazılmaz/güncellenmez.
- Oyun bittikten sonra yön tuşları hareket ettirmez; sadece `Enter`/`Space`/buton yeniden başlatır. Duraklatma oyun bittiyse açılamaz.
- `AudioContext` oluşturulamazsa veya tarayıcı sesi engellerse oyun sessiz devam eder, konsol hatası görünmez.
- Buton odaktayken Enter/Space global kısayol tarafından yeniden başlatma olarak yakalanmaz; butonun kendi tıklaması çalışır.

## 4. Kabul senaryoları
1. Açılışta kabin, neon marquee ve cam ekran görünür; yılan 3 hücre, yem görünür, skor `0`, durum `HAZIR`, kayıtlı rekor varsa gösterilir.
2. Ok tuşları, WASD ve D-pad yönü değiştirir; ters dönüş ve çift basış hatası olmaz.
3. Yem yendiğinde skor `+1` artar, yılan bir hücre uzar, kısa ses duyulur ve yeni yem yılan dışında bir hücreye konur.
4. Duvara veya gövdeye çarpınca overlay görünür, çarpma sesi duyulur, skor korunur, rekor güncellenir.
5. Sayfa yenilendiğinde en yüksek skor ve ses tercihi korunur.
6. `Enter`, `Space` veya buton ile yeniden başlatınca yılan/skor sıfırlanır, overlay gizlenir, canvas odaklanır.
7. Tarayıcı konsolunda hata veya uyarı yoktur.
8. `P` veya Duraklat butonu oyunu durdurur; "DURAKLATILDI" ekranı görünür, yön tuşları etkisizdir.
9. Tekrar `P` veya Devam butonu oyunu kaldığı yerden sürdürür, zaman sıçraması olmaz.
10. Ses Kapalı/Açık butonu `aria-pressed` durumunu ve buton görünümünü günceller.
11. Dar ekranda (mobil) kabin ve D-pad taşmadan görünür, dokunmayla sayfa kaymaz.

## 5. Doğrulama
`node --check game.js` sözdizimi kontrolü yapılır; `index.html` doğrudan tarayıcıda açılıp yukarıdaki 11 senaryo sırayla kontrol edilir.

## 6. Yapılmayacaklar (non-goals)
Hız artışı, duraklatma menüsü seçenekleri, kaydırma (swipe) hareketi, harici ses/görsel dosyası, framework, backend, sunucu tarafı kayıt.
