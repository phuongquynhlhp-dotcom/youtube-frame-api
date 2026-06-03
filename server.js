const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);
const app = express();

// Danh sách các máy chủ Cobalt Instances công cộng được cập nhật mới nhất
const COBALT_INSTANCES = [
  "https://cobalt.sm64.xyz/api/json",
  "https://co.wuk.sh/api/json",
  "https://api.cobalt.tools/api/json",
  "https://cobalt.lonami.dev/api/json",
  "https://cobalt.bndkt.me/api/json"
];

app.get('/api/frame', async (req, res) => {
  const videoId = req.query.videoId;
  const time = req.query.time;

  if (!videoId || !time) {
    return res.status(400).send('Thiếu videoId hoặc time.');
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`[1] Khởi động V8 - Đang rà soát mạng lưới Cobalt cho video: ${videoId}...`);

  let directUrl = null;

  // Lặp qua từng máy chủ Cobalt cho đến khi có một trạm chấp nhận dải IP của Render
  for (const instance of COBALT_INSTANCES) {
    try {
      console.log(`-> Thử kết nối trạm: ${instance}`);
      const cobaltResponse = await fetch(instance, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          url: videoUrl,
          videoQuality: '720',
          downloadMode: 'video'
        }),
        signal: AbortSignal.timeout(6000) // Đợi tối đa 6 giây mỗi trạm
      });

      if (!cobaltResponse.ok) {
        console.log(`Trạm ${instance} trả về lỗi ${cobaltResponse.status}. Chuyển trạm...`);
        continue;
      }

      const data = await cobaltResponse.json();
      if (data.status === 'stream' || data.url) {
        directUrl = data.url;
        console.log(`[2] Thành công rực rỡ! Trạm ${instance} đã thông qua.`);
        break; // Thoát vòng lặp khi đã tìm thấy link sạch
      }
    } catch (e) {
      console.log(`Trạm ${instance} bị nghẽn hoặc từ chối kết nối. Thử trạm kế tiếp...`);
    }
  }

  if (!directUrl) {
    return res.status(500).send('Toàn bộ các trạm vệ tinh Cobalt hiện tại đều từ chối luồng từ Render. Vui lòng nhấn F5 thử lại sau ít phút.');
  }

  console.log(`[3] Tiến hành cắt ảnh bằng FFmpeg tại mốc: ${time}...`);
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
  console.log('Máy chủ V8 (Cobalt Multi-Instance) đang chạy ở cổng ' + listener.address().port);
});
