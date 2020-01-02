const VP = {
    parseHTML: (buffer) => {
        let decoder = new TextDecoder("windows-1251");
        let text = decoder.decode(buffer);
        const oParser = new DOMParser();
        return oParser.parseFromString(text, "text/html").body;
    },

    postData: async (url = '', data = {}, method) => {
        // Default options are marked with *
        return await fetch(url, {
            method: 'POST', // *GET, POST, PUT, DELETE, etc.
            // mode: 'cors', // no-cors, *cors, same-origin
            cache: 'no-cache', // *default, no-cache, reload, force-cache, only-if-cached
            // credentials: 'same-origin', // include, *same-origin, omit
            // headers: {
            //     // 'Content-Type': 'application/json'
            //     'Content-Type': 'application/x-www-form-urlencoded',
            // },
            // redirect: 'follow', // manual, *follow, error
            // referrerPolicy: 'no-referrer', // no-referrer, *client
            body: data // body data type must match "Content-Type" header
        });
    },

    postDataHtml: async (url, data) => {
        const formData = new URLSearchParams();
        for (const [name, value] of Object.entries(data)) {
            formData.append(name, value);
        }
        return VP.postData(url, formData).then(r => r.arrayBuffer()).then(buffer => VP.parseHTML(buffer))
    },

    getHtml: async (url) => {
        return await fetch(url).then(r => r.arrayBuffer()).then(buffer => VP.parseHTML(buffer))
    },

    getFormTransaction: async (objectId, resourceName) => {
        const html = await VP.getHtml(`/object.php?id=${objectId}`);
        const resourceField = html.querySelector(`input[name=resource][value=${resourceName}]`);

        if (resourceField) {
            const form = resourceField.parentNode;
            if (!form) {
                return 'не могу найти форму';
            } else {
                const availableAmount = Number.parseFloat(form.parentNode.parentNode.cells[2].innerText);

                const canBuy = Number.parseFloat(form.parentNode.parentNode.cells[3] ? form.parentNode.parentNode.cells[3].innerText : 0);
                const formValues = Array.from(form.elements).reduce((acc, el) => {
                    if (el.name) {
                        acc[el.name] = el.value;
                    }
                    return acc;
                }, {});
                return {
                    availableAmount,
                    formValues,
                    canBuy
                }

            }
        } else {
            const resourceLink = html.querySelector(`a[href='/statlist.php?r=${resourceName}']`);
            if (resourceLink) {
                const availableAmount = Number.parseFloat(resourceLink.parentNode.parentNode.cells[2].innerText);
                const canBuy = Number.parseFloat(resourceLink.parentNode.parentNode.cells[3].innerText);
                return {
                    availableAmount,
                    canBuy
                }
            }
            return html.innerHTML;
        }
    },

    asyncTimeout: (ms) => {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};
