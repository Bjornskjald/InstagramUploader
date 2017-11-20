const Client = require('instagram-private-api').V1;
const path = require('path')
const fs = require('fs')
const jimp = require('jimp')
const loadhtml = name => document.querySelector('main').innerHTML = fs.readFileSync(path.join(__dirname, 'html', name + '.html'))
const cookiepath = process.platform === "win32" ? path.join(process.env.appdata, 'InstagramUploader', 'cookie.json') : path.join(require('os').homedir(), '.instagramuploader')

const storage = new Client.CookieFileStorage(cookiepath)
var session

function login () {
	const username = document.querySelector('#username').value
	const password = document.querySelector('#password').value
	var device
	try {
		device = new Client.Device(storage.storage.idx["i.instagram.com"]["/"].igfl.value)
	} catch (e) {
		device = new Client.Device(username)
	}
	loadhtml('preloader')
	Client.Session.create(device, storage, username, password)
	.then(session => {
		session.getAccount().then(account => {
			handleUpload(session, account)
		})
	})
	.catch(err => {
		console.error(err)
		loadhtml('login')
		if (err.message === "The password you entered is incorrect. Please try again.") return alert("Niepoprawna nazwa użytkownika lub hasło.")
		alert('Błąd logowania.')
	})
}

if (Object.keys(storage.storage.idx).length !== 0 && storage.storage.idx["i.instagram.com"]["/"].igfl) login()

function handleUpload (session, account) {
	loadhtml('upload')
	document.querySelector('#logged-in').innerHTML += account.params.fullName
	var files
	document.querySelector('#files').addEventListener('change', e => {
		files = document.querySelector('#files').files
		document.querySelector('#thumbnails').innerHTML = ''
		Array.from(files).forEach(file => {
			if (!file.type.startsWith('image/')){ return }
			var img = document.createElement('img')
			img.style = 'height: 100px; width: 100px; object-fit: cover; flex-basis: 33%;'
			img.classList.add('materialboxed')
			img.file = file
			document.querySelector('#thumbnails').appendChild(img)
			var reader = new FileReader()
			reader.onload = (aImg => { return e => { aImg.src = e.target.result } })(img)
			reader.readAsDataURL(file)
		})
	})
	document.querySelector('#upload').addEventListener('click', e => {
		var actions = Array.from(files).map(file => processFileAsync(file, session))
		var results = Promise.all(actions)
		results.then(a => {
			alert('All photos uploaded!')
			loadhtml('upload')
			document.querySelector('#logged-in').innerHTML += account.params.fullName
		}).catch(console.error)
	})
}

function processFileAsync (file, session) {
	return new Promise((resolve, reject) => {
		var caption = document.querySelector('#caption').value
		if (!file.type.startsWith('image/')){ return }
		var reader = new FileReader()
		var b64string
		reader.onload = e => { 
			var input = Buffer.from(e.target.result.replace(/^data:([A-Za-z-+/]+);base64,/, ''), 'base64')
			jimp.read(input).then(image => {
				var w = image.bitmap.width
				var h = image.bitmap.height
				var c = w > h ? h : w
				var wd = w > h ? (w - h)/2 : 0
				var hd = h > w ? (h - w)/2 : 0
				image.crop(wd, hd, c, c).getBuffer(jimp.MIME_JPEG, (err, output) => {
					Client.Upload.photo(session, output)
					.then(upload => {
						console.log('here works')
						return Client.Media.configurePhoto(session, upload.params.uploadId, caption)
					})
					.then(medium => {
						console.log('here too')
						console.log('success!', medium)
						resolve()
					})
					.catch(error => {
						console.error(error)
						if (error.name === 'AuthenticationError') {
							alert('Błąd logowania')
							loadhtml('login')
							reject('AuthError')
						}
					})
				})
			})
		}
		reader.readAsDataURL(file)
	})
}