const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);
const app = express();

// Cập nhật danh sách các trạm API trung gian mới và hoạt động tốt nhất
const INVIDIOUS_INSTANCES = [
  "https://invidious.asir.dev",
  "https://iv.melmac.space",
  "https://invidious.io.lol",
  "https://invidious.jing.rocks",
  "https://yewtu.be",
  "https://vid.puffyan.us"
];

app.get('/api/frame', async (req, res) => {
  const videoId = req.query.videoId;
  const time = req.query.time;

  if (!videoId || !time) {
    return res.status(400).send('Thiếu videoId hoặc time.');
  }

  console.log(`[1] Khởi động V5 - Đang quét luồng video cho ID: ${videoId}...`);
  let directUrl = null;

  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const apiUrl = `${instance}/api/v1/videos/${videoId}`;
      // Cài đặt thời gian chờ (timeout) 4 giây mỗi trạm để chuyển trạm khác cho nhanh nếu bị nghẽn
      const response = await fetch(apiUrl, { signal: AbortSignal.timeout(4000) });
      
      if (!response.ok) continue;
      const data = await response.json();
      
      // HƯỚNG SỬA V5:
      // Cách 1: Tìm luồng chuẩn có cả hình lẫn tiếng (MP4)
      if (data.formatStreams && data.formatStreams.length > 0) {
        const format = data.formatStreams.find(f => f.container === 'mp4');
        if (format) directUrl = format.url;
      }
      
      // Cách 2: Nếu cách 1 thất bại (đặc biệt với livestream), tìm luồng "Chỉ có hình - Video Only" (MP4)
      if (!directUrl && data.adaptiveFormats && data.adaptiveFormats.length > 0) {
        const format = data.adaptiveFormats.find(f => f.container === 'mp4' && f.type && f.type.includes('video'));
        if (format) directUrl = format.url;
      }

      if (directUrl) {
        console.log(`[2] Thành công! Đã tìm thấy luồng video từ trạm: ${instance}`);
        break; 
      }
    } catch (e) {
      console.log(`Trạm ${instance} không phản hồi hoặc hết thời gian chờ. Thử trạm kế tiếp...`);
    }
  }

  if (!directUrl) {
    return res.status(500).send('Mạng lưới API trung gian đang bận xử lý dữ liệu luồng. Vui lòng nhấn F5 thử lại sau vài giây.');
  }

  console.log(`[3] Đang tiến hành cắt ảnh tại mốc thời gian: ${time}...`);
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
  console.log('Máy chủ V5 (Deep Search Video-Only) đang chạy ở cổng ' + listener.address().port);
});
