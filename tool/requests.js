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
                alert('нет формы');
            } else {
                return Array.from(form.elements).reduce((acc, el) => {
                    if (el.name) {
                        acc[el.name] = el.value;
                    }
                    return acc;
                }, {});
            }
        } else {
            return html.body.innerHTML;
        }
    }
};
