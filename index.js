const { app, BrowserWindow, ipcMain, shell } = require('electron')
const ffmpeg = require('fluent-ffmpeg')

let mainWindow

app.on('ready', () => {

  mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
    webPreferences: { backgroundThrottling: false }
  })
  mainWindow.loadURL(`file://${__dirname}/src/index.html`)
})

ipcMain.on('videos:added', (e, videos) => {

  const promisesArray = videos.map(video => {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(video.path, (err, metadata) => {
        err ? console.log('ffprobe err:', err) : null
        video.duration = metadata.format.duration
        video.format = 'avi' // Default to 'avi'
        resolve(video)
      })
    })
  })

  // .all() method waits for all Promises in
  // promisesArray to resolve before `Promise`
  // that is called on resolves itself

  Promise.all(promisesArray)
    .then(videosArrayWithMetadata => {
      mainWindow.webContents.send('videos:metadata', videosArrayWithMetadata)
    })
})

ipcMain.on('conversion:start', (e, videos) => {

  videos.forEach(video => {
    const outputDirectory = video.path.split(video.name)[0]
    const splitName = video.name.split('.')
    const outputName = splitName.length === 3 ? splitName.slice(0, 2).join('. ') : splitName[0]
    const outputPath = `${outputDirectory}${outputName}.${video.format}`

    ffmpeg(video.path)
      .output(outputPath)
      .on('progress', ({ timemark }) =>
        mainWindow.webContents.send('conversion:progress', { video, timemark }))
      .on('end', () => {
        console.log('FFMPEG: Video conversion complete')
        mainWindow.webContents.send('conversion:end', { video, outputPath })
      })
      .run()
  })
})

ipcMain.on('folder:open', (e, outputPath) => {
  shell.showItemInFolder(outputPath)
})