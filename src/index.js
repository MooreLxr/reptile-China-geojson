var https = require('https')
var fs = require('fs')

const uploadDir = './public/data/'
const boundAllUrl = 'https://geo.datav.aliyun.com/areas_v3/bound/all.json'
const boundGeojsonUrl = 'https://geo.datav.aliyun.com/areas_v3/bound/geojson?code='

// isFull===true ? 更新带子级的geojson数据+区域数据 : 不带子级的geojson数据+区域数据(默认)
const isFull = process.argv.slice(-1)[0] === 'full'
// 只更新区域数据
const justArea = process.argv.slice(-1)[0] === 'area'

httpsGetFn(boundAllUrl).then(async (res) => {
	logSuccess('所有行政区划数据读取成功')
	writeToFile(`${uploadDir}China.json`, res)
	logSuccess('所有行政区划数据写入China.json成功')

	const fullData = JSON.parse(res)
	// 读取省市行政区划 
	await getProvinceAndCity(fullData)
	if (justArea) {
		logSuccess(`全部执行完毕，文件保存在${uploadDir}`)
		return
	}
	// 读取省市geojson
	await getProvinceAndCityGeojson(fullData)
}).catch(() => {
	logError('读取失败')
})

// 从全量数据中读取各省/市的下级区划
function getProvinceAndCity (list) {
	list.forEach(item => {
		if (item.level === 'district') return // 区县忽略
		const res = {
			...item,
			children: [],
			total: 0
		}
		res.children = list.filter(e => e.parent === item.adcode)
		res.total = res.children.length
		writeToFile(`${uploadDir}${item.adcode}.json`, JSON.stringify(res))
		logSuccess(`${item.name}写入成功`)
	})
}

// 从全量数据中读取各省/市的geojson数据
function getProvinceAndCityGeojson (list) {
	const each = (index) => {
		if(index === list.length) {
			logSuccess(`全部执行完毕，文件保存在${uploadDir}`)
			return
		}
		const item = list[index]
		if (item.level === 'district') { // 区县忽略
			++index
			each(index)
			return
		}
		// isFull=true: https://geo.datav.aliyun.com/areas_v3/bound/geojson?code=100000_full
		// isFull=false: https://geo.datav.aliyun.com/areas_v3/bound/geojson?code=100000
		httpsGetFn(`${boundGeojsonUrl}${item.adcode}${isFull ? '_full':''}`).then(res => {
			writeToFile(`${uploadDir}${item.adcode}${isFull ? '_full':''}_geojson.json`, res)
			logSuccess(`${item.name} geojson写入成功`)
			++index
			each(index)
		})
	}
	each(0)
}

// 写入文件
function writeToFile (dir, data) {
	const fd = fs.openSync(dir,'w+')
	fs.writeFileSync(fd, data)
	fs.closeSync(fd)
}

function logSuccess(log){
	Array.prototype.push.call(arguments,'\033[0m')
	Array.prototype.unshift.call(arguments,'\033[;32m =>')
	console.log.apply(this,arguments)
}

function logError(log){
	Array.prototype.push.call(arguments,'\033[0m')
	Array.prototype.unshift.call(arguments,'\033[;31m =>')
	console.log.apply(this,arguments)
}

function httpsGetFn(url, cb) {
	return new Promise((resolve, reject) => {
		https.get(url, res => {
			res.setTimeout(5000)
			res.setEncoding('utf8')
	
			let resData = ''
			res.on('data', data => {
				resData += data
			})
			res.on('end', () => {
				resolve(resData)
			})
		}).on('error', e => {
			reject(e)
		})
	})
}