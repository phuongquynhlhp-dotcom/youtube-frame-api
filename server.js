const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);
const app = express();

app.get('/api/frame', async (req, res) => {
  const videoId = req.query.videoId;
  const time = req.query.time;

  if (!videoId || !time) {
    return res.status(400).send('Thiếu videoId hoặc time.');
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`[1] Khởi động V7 - Sử dụng siêu bộ lọc Cobalt API cho video: ${videoId}...`);

  try {
    // Gọi API của Cobalt - Hệ thống vượt rào YouTube mạnh nhất hiện nay
    const cobaltResponse = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        url: videoUrl,
        videoQuality: '720',    // Lấy chất lượng 720p rõ nét để AI đọc số chuẩn
        downloadMode: 'video'   // Chỉ bóc tách luồng video, bỏ qua tiếng
      }),
      signal: AbortSignal.timeout(12000) // Cho phép chờ tối đa 12 giây vì Cobalt xử lý hơi sâu
    });

    if (!cobaltResponse.ok) {
      throw new Error(`Cobalt API trả về mã lỗi: ${cobaltResponse.status}`);
    }

    const data = await cobaltResponse.json();
    
    if (data.status === 'error') {
      throw new Error(`Cobalt từ chối: ${data.text}`);
    }

    // Cobalt trả về link stream trực tiếp trong trường 'url'
    const directUrl = data.url;
    if (!directUrl) {
      throw new Error("Không tìm thấy đường link video trực tiếp từ Cobalt.");
    }

    console.log(`[2] Kết nối Cobalt thành công! Tiến hành cắt ảnh bằng FFmpeg tại mốc: ${time}...`);
    res.setHeader('Content-Type', 'image/jpeg');

    // Tiến hành cắt ảnh từ đường link siêu sạch của Cobalt
    ffmpeg(directUrl)
      .seekInput(time)
      .frames(1)
      .format('image2')
      .on('error', (err) => {
         console.error('Lỗi FFmpeg:', err);
         if (!res.headersSent) res.status(500).send('Lỗi trích xuất khung hình: ' + err.message);
      })
      .pipe(res, { end: true });

  } catch (error) {
    console.error('Lỗi hệ thống V7:', error.message);
    if (!res.headersSent) {
      res.status(500).send('Hệ thống đang quá tải bộ lọc YouTube. Vui lòng nhấn F5 thử lại sau vài giây: ' + error.message);
    }
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Máy chủ V7 (Cobalt Engine Siêu Vượt Rào) đang chạy ở cổng ' + listener.address().port);
});
