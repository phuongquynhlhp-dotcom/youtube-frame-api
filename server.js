const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);
const app = express();

// Danh sách các máy chủ Invidious dự phòng (Nếu máy chủ này hỏng thì tự nhảy sang máy chủ khác)
const INVIDIOUS_INSTANCES = [
  "https://vid.puffyan.us",
  "https://invidious.jing.rocks",
  "https://yewtu.be",
  "https://invidious.nerdvpn.de"
];

app.get('/api/frame', async (req, res) => {
  const videoId = req.query.videoId;
  const time = req.query.time;

  if (!videoId || !time) {
    return res.status(400).send('Thiếu videoId hoặc time.');
  }

  console.log(`[1] Đang tìm link luồng trực tiếp cho video ${videoId} qua API bên thứ ba...`);
  
  let directUrl = null;

  // Lặp qua các máy chủ trung gian cho đến khi tìm được link tải
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const apiUrl = `${instance}/api/v1/videos/${videoId}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      // Tìm luồng định dạng MP4 (ưu tiên chất lượng 720p hoặc cao nhất có thể)
      const format = data.formatStreams.find(f => f.container === 'mp4' && f.resolution === '720p') || 
                     data.formatStreams.find(f => f.container === 'mp4');
                     
      if (format && format.url) {
        directUrl = format.url;
        console.log(`[2] Đã lấy link thành công từ máy chủ: ${instance}`);
        break; 
      }
    } catch (e) {
      console.log(`Bỏ qua máy chủ ${instance} do không phản hồi.`);
    }
  }

  if (!directUrl) {
    return res.status(500).send('Mạng lưới API trung gian đang quá tải, không thể lấy link video lúc này. Vui lòng thử lại sau.');
  }

  console.log(`[3] Đang tiến hành cắt ảnh tại mốc ${time}...`);
  res.setHeader('Content-Type', 'image/jpeg');

  ffmpeg(directUrl)
    .seekInput(time)
    .frames(1)
    .format('image2')
    .on('error', (err) => {
       console.error('Lỗi FFmpeg:', err);
       if (!res.headersSent) res.status(500).send('Lỗi trong quá trình xử lý ảnh: ' + err.message);
    })
    .pipe(res, { end: true });
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Máy chủ V4 (Dùng API Trung gian) đang chạy ở cổng ' + listener.address().port);
});
