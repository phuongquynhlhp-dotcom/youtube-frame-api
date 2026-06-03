const express = require('express');
const youtubedl = require('youtube-dl-exec');
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

  try {
    console.log(`[1] Đang dùng Cookies để vượt rào lấy link: ${videoId}...`);
    
    // Đã thêm dòng cookies: 'cookies.txt' để qua mặt YouTube
    const info = await youtubedl(videoUrl, {
      dumpSingleJson: true,
      noCheckCertificate: true,
      noWarnings: true,
      cookies: 'cookies.txt', 
      addHeader: [
        'referer:youtube.com', 
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
      ]
    });

    const format = info.formats.reverse().find(f => f.ext === 'mp4' && f.vcodec !== 'none');
    if (!format) throw new Error("Không tìm thấy luồng video phù hợp.");
    
    const directUrl = format.url;
    console.log(`[2] Đã vượt rào thành công! Tiến hành cắt ảnh tại ${time}...`);

    res.setHeader('Content-Type', 'image/jpeg');

    ffmpeg(directUrl)
      .seekInput(time)
      .frames(1)
      .format('image2')
      .on('error', (err) => {
         console.error('Lỗi FFmpeg:', err);
         if (!res.headersSent) res.status(500).send('Lỗi cắt ảnh: ' + err.message);
      })
      .pipe(res, { end: true });

  } catch (error) {
    console.error('Lỗi hệ thống:', error.message);
    if (!res.headersSent) res.status(500).send('Không thể xử lý video: ' + error.message);
  }
});

const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Máy chủ V3 (Dùng Thẻ Căn Cước) đang chạy ở cổng ' + listener.address().port);
});
