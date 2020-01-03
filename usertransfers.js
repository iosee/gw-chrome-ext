const stats = {};
const transactions = [];

function isToday(dateStr) {
    const today = new Date();
    const dateParts = dateStr.split(' ')[0].split('.');
    let day = Number(dateParts[0]);
    if (today.getDate() === day && today.getMonth() + 1 === Number(dateParts[1])) {
        return true;
    } else {
        return false;
    }
}

async function collectStats(page, cb) {
    const html = await VP.getHtml('/transfers.php?page_id=' + page);
    if (html.innerText.includes('Транзакции не найдены')) {
        cb();
        return;
    }
    const rows = Array.from(html.querySelectorAll('.gw-container>table')[2].tBodies[0].rows);

    for (let row of rows) {
        const parts = row.innerText.split('\n');
        const time = parts[2];
        if (!isToday(time, 0)) {
            cb();
            return;
        }

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
}


function buildStatsInterface() {
    const container = document.querySelector('.gw-container');
    const info = document.createElement('div');
    info.className = 'vp-info';

    let content = '';
    let total = 0;

    for (const [name, data] of Object.entries(stats)) {
        const sellPrice = data.sell.price || 0;
        const sellCount = data.sell.count || 0;
        const buyCount = data.buy.count || 0;
        const buyPrice = data.buy.price || 0;
        const totalPrice = sellPrice - buyPrice;
        total += totalPrice;
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
    info.innerHTML = `<div> Total profit: <b>${total}</b></div>${content}`;

    container.insertBefore(info, container.children[2]);
}



if (location.href.indexOf('/usertransfers.php') !== -1) {
    collectStats(0, () => {
        console.log(stats);
        buildStatsInterface();
    });
}
