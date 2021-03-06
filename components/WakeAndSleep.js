/**
 * @jsx React.DOM
 */

var React = require('react');
var Moment = require('moment');
var _ = require('lodash');
var PureRenderMixin = require('react/addons').addons.PureRenderMixin;
var ReactBootStrap = require('react-bootstrap');
var numeral = require('numeral');
var DataAPI = require('../utils/DataAPI');
var Util = require('../utils/Util');
var Q = require('q');


var WakeAndSleep = React.createClass({

    getInitialState: function () {
        return {
            meanSleep: null,
            meanWake: null,
            meanSleepLength: null
        };
    },

    render: function () {
        var meanWake = this.state.meanWake;
        var meanSleep = this.state.meanSleep;
        var meanSleepLength = this.state.meanSleepLength;
        return <p className="ltt_c-WakeSleep wake-sleep">
            <span className="wake">{meanWake ? Moment(meanWake).format('HH:mm') : null}</span>
            <span className="gap">~</span>
            <span className="sleep">{meanSleep ? Moment(meanSleep).format('HH:mm') : null}</span>
            <span className="gap"> = </span>
            <span className="sleepLen">{meanSleepLength ? Util.displayTime(meanSleepLength) : null}</span>
        </p>
    },

    componentWillMount: function () {
        this.loadSleepWakeData();
    },

    loadSleepWakeData: function () {
        var that = this;
        var mStart = new Moment(this.props.start);
            mEnd = new Moment(this.props.end);
        Q.allSettled([
            DataAPI.Stat.wakeAndSleep({
                start: mStart.format(Util.DATE_FORMAT),
                end: mEnd.format(Util.DATE_FORMAT),
                group: 'type'
            }),
            DataAPI.Stat.sleepLength({
                start: mStart.format(Util.DATE_FORMAT),
                end: mEnd.format(Util.DATE_FORMAT),
                mean: true
            })
        ]).spread(function (wakeAndSleepResult, meanResult) {
            var res = wakeAndSleepResult.value;
            var meanSleepLength = meanResult.value.mean;
            var wakeData = res.wake || [];
            var sleepData = res.sleep || [];
            var wakeLen = wakeData.length;
            var sleepLen = sleepData.length;
            var wakeSum = wakeData.reduce(function (t, wt) {
                var mt = new Moment(wt.start);
                var base = Moment(wt.date).startOf('day');
                return t + mt.diff(base, 'minute');
            }, 0);
            meanWake =  new Moment().startOf('day').add(wakeSum / wakeLen, 'minute');
            var sleepSum = sleepData.reduce(function (t, st) {
                var mt = new Moment(st.start);
                var base = Moment(st.date).endOf('day');
                return t + mt.diff(base, 'minute');
            }, 0);
            meanSleep =  new Moment().endOf('day').add(sleepSum / sleepLen, 'minute');
            that.setState({
                wakeData: wakeData,
                sleepData: sleepData,
                meanWake: meanWake.toDate(),
                meanSleep: meanSleep.toDate(),
                meanSleepLength: meanSleepLength
            });
        });
    }
});

module.exports = WakeAndSleep;