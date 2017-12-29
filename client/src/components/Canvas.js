import React, {Component} from 'react';
import uuidv4 from 'uuid/v4';

import {createTxn, deleteRow, insertRow, updateRow} from "../actions/database";
import {add, equals, subtract} from "../util/math";

export default class Canvas extends Component {

    constructor(props) {
        super(props);
        this.state = {
            selectedId: undefined,
            curPos: undefined,
            downPos: undefined
        }
    }

    // --------------------------------------------- handlers ---------------------------------------------------------
    onKeyPress = (e) => {
        if (e.key === 'd' && this.state.selectedId) {
            const change = deleteRow("circles", this.selectedCircle);
            const txn = createTxn([change]);
            this.props.commit(txn);
            this.setState({selectedId: undefined});
        }
    };

    onMouseDown = (e) => {
        this.setState({selectedId: undefined});
    };

    onMouseMove = (e) => {
        super.setState({
            curPos: [e.clientX, e.clientY]
        })
    };

    onMouseUp = (e) => {
        if (this.state.selectedId === undefined) {
            const circle = {
                id: uuidv4(),
                cx: e.clientX,
                cy: e.clientY,
                r: 40,
                stroke: "green",
                strokeWidth: 4,
                fill: "yellow"
            };
            const change = insertRow("circles", circle);
            const txn = createTxn([change]);
            this.props.commit(txn);
        } else {
            if (!this.state.selectedId) return;
            if (equals(this.state.curPos, this.state.downPos)) {
                // select
                this.setState({downPos: undefined});
            } else {
                // drag
                const newCircle = {...this.selectedCircle, cx: e.clientX, cy: e.clientY};
                const change = updateRow("circles", newCircle, this.props.state);
                const txn = createTxn([change]);
                this.props.commit(txn);
                this.setState({selectedId: undefined, downPos: undefined});
            }
        }
    };

    // ------------------------------------------- properties ---------------------------------------------------------
    get selectedCircle() {
        return this.props.circles.rows.find(c => c.id === this.state.selectedId);
    }

    get selectedItem() {
        if (!this.state.selectedId) return [];
        const selPos = [this.selectedCircle.cx, this.selectedCircle.cy];
        const pos = this.state.downPos ? add(selPos, subtract(this.state.curPos, this.state.downPos)) : selPos;
        return <circle key="dragItem" cx={pos[0]} cy={pos[1]}
                       r="40" fill="blue" fillOpacity="0.5"/>
    }

    get circles() {
        if (!this.props.circles) return [];
        return this.props.circles.rows
            .map(c => <circle key={c.id} cx={c.cx} cy={c.cy} r={c.r} stroke={c.stroke} onMouseDown={this.onObjectDown}
                              strokeWidth={c.strokeWidth} fill={c.fill} id={c.id}/>)
    }

    get rectangles() {
        if (!this.props.rectangles) return [];
        return this.props.rectangles.rows
            .map(r => <rect key={r.id} width={r.width} height={r.height}
                            fill={r.fill} strokeWidth={r.strokeWidth}
                            stroke={r.stroke}/>)
    }

    onObjectDown = (e) => {
        this.setState({
            selectedId: e.target.id,
            curPos: [e.clientX, e.clientY],
            downPos: [e.clientX, e.clientY]
        });
        e.stopPropagation();
    };

    // -------------------------------------------- render ------------------------------------------------------------
    render() {
        return <svg width="100" height="100"
                    onMouseDown={this.onMouseDown}
                    onMouseMove={this.onMouseMove}
                    onMouseUp={this.onMouseUp}
                    onKeyPress={this.onKeyPress}
                    tabIndex="0"
        >
            {this.rectangles}
            {this.circles}
            {this.selectedItem}
        </svg>

    }
}