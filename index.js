
function filterMap (x,y) {
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
			const clearButton =  document.createElement('span');
			const xy = a.href.replace(/.*sx=(\d+)&sy=(\d+)/gi, '$1,$2');
			const [x, y] = xy.split(',');
			a.innerHTML = `[${xy}]`;
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

function formatHistory() {
	
}

if (location.href.indexOf('statlist.php') !== -1) {
	fixUI();
}
