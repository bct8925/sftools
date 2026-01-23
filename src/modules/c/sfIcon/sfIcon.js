// SF Icon - LWC version of display-only icon component
import { LightningElement, api } from 'lwc';
import { icons } from '../../../lib/icons.js';

export default class SfIcon extends LightningElement {
    _name = '';

    @api
    get name() {
        return this._name;
    }
    set name(value) {
        this._name = value;
        this.renderIcon();
    }

    renderedCallback() {
        this.renderIcon();
    }

    renderIcon() {
        const container = this.template.querySelector('.icon-container');
        if (container) {
            container.innerHTML = this._name && icons[this._name] ? icons[this._name] : '';
        }
    }
}
