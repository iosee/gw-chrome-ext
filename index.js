let cache = {};


function filterMap(x, y) {
    return Array.from(document.querySelectorAll('a'))
        .filter(a => {
            if (a.href.indexOf('map.php?sx') !== -1) {
                a.parentNode.parentNode.style.display = null;
                if (x && y) {
                    const xy = a.href.replace(/.*sx=(\d+)&sy=(\d+)/gi, '$1,$2')
                    return xy !== `${x},${y}`
                }
            }
            return false;
        }).forEach(a => a.parentNode.parentNode.style.display = 'none')
}

function fixUI() {
    return Array.from(document.querySelectorAll('a'))
        .filter(a => {
            if (a.href.indexOf('map.php?sx') !== -1) {
                const button = document.createElement('span');
                const clearButton = document.createElement('span');
                const xy = a.href.replace(/.*sx=(\d+)&sy=(\d+)/gi, '$1,$2');
                const [x, y] = xy.split(',');
                a.innerHTML = `${a.innerHTML}[${xy}]`;
                button.innerText = 'Y';
                clearButton.className = button.className = 'vp-filter';

                button.onclick = () => {
                    filterMap(x, y);
                };

                clearButton.innerText = 'x';
                clearButton.onclick = filterMap.bind(this, 0, 0);
                a.parentNode.appendChild(button);
                a.parentNode.appendChild(clearButton);
            }
        })
}

function addForm() {
    const form = document.createElement('div');
    form.innerHTML = '<input class="vp-input" id="initial price" type="number">'
    const container = document.querySelectorAll('center>table').parentNode;
}

function cacheMap() {
    const [buyersTable, sellersTable] = document.querySelectorAll('center>table table');

    cache = {
        buyers: cacheTable(buyersTable),
        sellers: cacheTable(sellersTable)
    };
}

function cacheTable(table) {
    const res = {};
    Array.from(table.tBodies[0].rows).slice(1).forEach((line) => {
        const [x, y] = line.cells[0].firstElementChild.href.replace(/.*?sx=(\d+)&sy=(\d+).*/g, '$1,$2').split(',');
        const count = Number(line.cells[1].innerText);
        const price = Number(line.cells[2].innerText.replace(/\D+/i, ''));
        if (!res[`${x},${y}`]) {
            res[`${x},${y}`] = [];
        }
        res[`${x},${y}`].push({
            element: line,
            price,
            count,
            x,
            y
        })
    });
    return res;
}

const stats = {};
let lines = 0;
const transactions = [];
function collectStats(page, cb) {
    fetch('transfers.php?page_id=' + page)
        .then(response => response.arrayBuffer())
        .then(buffer => {
            let decoder = new TextDecoder("windows-1251");
            let text = decoder.decode(buffer);

            if (text.includes('Транзакции не найдены')) {
				cb();
            	return;
			}

			const oParser = new DOMParser();
			const oDOM = oParser.parseFromString(text, "text/html").body;
			const rows = Array.from(oDOM.querySelectorAll('.gw-container>table')[2].tBodies[0].rows);

			for (let row of rows) {
				const parts = row.innerText.split('\n');
				const time = parts[2];
				if (transactions.indexOf(time) !== -1) {
					continue;
				}
				transactions.push(time);

				const match = parts[3].match(/[^\s]+\s([^\s]+)\s(\d+)\s(.+?)\sза\s(\d+)/i);
				const name = match[3];
				const action = match[1] === 'продал' ? 'sell' : 'buy';
				const count = Number(match[2]);
				const price = Number(match[4]);
				if (!stats[name]) {
					stats[name] = {buy: {}, sell: {}}
				}

				stats[name][action] = {
					count: (stats[name][action].count || 0) + count,
					price: (stats[name][action].price || 0) + price
				};
			}

			setTimeout(() => collectStats(page + 1, cb), 400);
        });
}

function buildStatsInterface() {
	const container = document.querySelector('.gw-container');
	const info = document.createElement('div');
	info.className = 'vp-info';

	let content = '';

	for (const [name, data] of Object.entries(stats)) {
		const sellPrice = data.sell.price || 0;
		const sellCount = data.sell.count || 0;
		const buyCount = data.buy.count || 0;
		const buyPrice = data.buy.price || 0;
		const totalPrice = sellPrice - buyPrice;
		content += `
			<div class="vp-section">
				<div class="vp-section-title">${name}</div>
				<div>
					${sellPrice.toLocaleString('en-GB')}(${sellCount.toLocaleString('en-GB')}) 
					- 
					${buyPrice.toLocaleString('en-GB')}(${buyCount.toLocaleString('en-GB')}) 
					= 
					<b>${totalPrice.toLocaleString('en-GB')}</b>
				</div>
			</div>
		`;
	}
	info.innerHTML = content;

	container.insertBefore(info, container.children[2]);
}

if (location.href.indexOf('statlist.php') !== -1) {
    cacheMap();
    console.log(cache);
    fixUI();
}
if (location.href.indexOf('transfers.php') !== -1) {
    collectStats(0, () => {
    	console.log(lines, stats)
		buildStatsInterface();
    });
}
