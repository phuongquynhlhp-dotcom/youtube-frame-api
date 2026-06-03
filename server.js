const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);
const app = express();

// Sử dụng mạng lưới Piped API - Chuyên gia ẩn danh và vượt rào YouTube hiện nay
const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://pipedapi.tokhmi.xyz",
  "https://api.piped.yt",
  "https://pipedapi.syncpundit.io"
];

app.get('/api/frame', async (req, res) => {
  const videoId = req.query.videoId;
  const time = req.query.time;

  if (!videoId || !time) {
    return res.status(400).send('Thiếu videoId hoặc time.');
  }

  console.log(`[1] Đang kết nối mạng lưới Piped API để lấy video: ${videoId}...`);
  let directUrl = null;

  for (const instance of PIPED_INSTANCES) {
    try {
      const apiUrl = `${instance}/streams/${videoId}`;
      // Chờ tối đa 5 giây, nếu trạm này chậm sẽ tự bỏ qua tìm trạm khác
      const response = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });
      
      if (!response.ok) continue;
      const data = await response.json();
      
      if (data.error) continue; // Bỏ qua nếu trạm báo lỗi

      // HƯỚNG XỬ LÝ V6: Tìm luồng MP4 được Proxy ẩn danh
      if (data.videoStreams && data.videoStreams.length > 0) {
        // Ưu tiên 1: Lấy bản 720p có cả hình lẫn tiếng
        let stream = data.videoStreams.find(s => s.quality === '720p' && s.format === 'MPEG_4' && !s.videoOnly);
        
        // Ưu tiên 2: Lấy bản 360p hoặc bất kỳ bản MP4 nào có hình lẫn tiếng
        if (!stream) stream = data.videoStreams.find(s => s.format === 'MPEG_4' && !s.videoOnly);
        
        // Ưu tiên 3: Lấy bản MP4 chỉ có hình (phù hợp với Livestream lưu trữ)
        if (!stream) stream = data.videoStreams.find(s => s.format === 'MPEG_4');
        
        if (stream && stream.url) {
          directUrl = stream.url;
          console.log(`[2] Tuyệt vời! Đã lấy link proxy ẩn danh từ trạm: ${instance}`);
          break; 
        }
      }
    } catch (e) {
      console.log(`Trạm ${instance} bị nghẽn. Thử trạm kế tiếp...`);
    }
  }

  if (!directUrl) {
    return res.status(500).send('Toàn bộ mạng lưới Piped đều đang bận. Vui lòng nhấn F5 thử lại sau vài giây.');
  }

  console.log(`[3] Đang tải luồng ẩn danh và cắt ảnh tại mốc: ${time}...`);
  res.setHeader('Content-Type', 'image/jpeg');

  ffmpeg(directUrl)
    .seekInput(time)
    .frames(1)
    .format('image2')
    .on('error', (err) => {
       console.error('Lỗi FFmpeg:', err);
       if (!res.headersSent) res.status(500).send('Lỗi trích xuất khung hình: ' + err.message);
    })
    .pipe(res, { end: true });
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Máy chủ V6 (Piped API Proxy) đang chạy ở cổng ' + listener.address().port);
});
