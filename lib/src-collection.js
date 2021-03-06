'use strict';

const VError    = require('verror');
const SrcFile   = require('./src-file');
const co        = require('co');
const cofse     = require('co-fs-extra');
const extend    = require('node.extend');
const EOL       = require('os').EOL;

function SharkTreeSrcCollection(data, destPath) {
	var srcArr = [];
	var content = null;

	this._dest      = destPath;
	this._options   = data.options;

	data.files.forEach(function(value) {
		srcArr.push(new SrcFile({
			src: value,
			content: null,
			dest: destPath,
			encoding: this._options.encoding || null
		}));
	}.bind(this));

	this._srcArr    = srcArr;
}

SharkTreeSrcCollection.prototype = {
	constructor: SharkTreeSrcCollection,

	getDest: function() {
		return this._dest;
	},

	getFileByIndex: function(index) {
		if (typeof index !== 'number') {
			throw new VError('srcFile index is not a number');
		}

		if (this.hasFileByIndex(index)) {
			return this._srcArr[index];
		}
		else {
			return null;
		}
	},

	hasFileByIndex: function(index) {
		if (typeof index !== 'number') {
			throw new VError('srcFile index is not a number');
		}

		return !!this._srcArr[index];
	},

	getOptions: function() {
		return this._options;
	},

	getContent: function() {
		this.transformToOneToOne();
		return this.getFirstFile().getContent();
	},

	setContent: function(content) {
		this.transformToOneToOneWithContent(content);
	},

	getCount: function() {
		return this._srcArr.length;
	},

	getFirstFile: function() {
		if (this.getCount() > 0) {
			return this._srcArr[0];
		}
		else {
			return null;
		}
	},

	forEach: function(cb) {
		this._srcArr.forEach(function(srcFile, index) {
			cb(srcFile, index);
		});
	},

	forEachSeries: function(cb) {
		return new Promise(function(fulfill, reject) {
			var srcArr = this._srcArr;
			var filesCount = this.getCount();

			var nextIteration = function(index) {
				var file = srcArr[index];
				cb(file, index, function(error) {
					var newIndex = index + 1;
					if (error) {
						reject(new VError(error, 'SrcCollection#forEachSeries nextIteration error'));
					}
					else {
						if (newIndex < filesCount) {
							nextIteration(newIndex);
						}
						else {
							fulfill();
						}
					}
				});
			};

			if (filesCount === 0) {
				fulfill();
			}
			else {
				nextIteration(0);
			}
		}.bind(this));
	},

	fillContent: function() {
		return this.forEachSeries(co.wrap(function *(srcFile, index, done) {
			try {
				yield srcFile.fillContent();
				done();
			}
			catch (error) {
				done(new VError(error, 'SrcCollection#fillContent error'));
			}
		}.bind(this)));
	},

	transformToOneToOne: function *() {
		if (this.getCount() <= 1) {
			yield this.getFirstFile().fillContent();
			return;
		}

		var content = '';
		var i = 0;
		var len = this._srcArr.length;
		var iLast = len - 1;
		for (; i < len; i += 1) {
			var srcFile = this._srcArr[i];
			yield srcFile.fillContent();
			content += srcFile.getContent();
			if (i != iLast) {
				content += EOL;
			}
		}

		this._srcArr = [new SrcFile({
			src: null,
			content: content,
			dest: this._dest,
			encoding: this._options.encoding || null
		})];
	},

	transformToOneToOneWithContent: function(content) {
		this._srcArr = [new SrcFile({
			src: null,
			content: content,
			dest: this._dest,
			encoding: this._options.encoding || null
		})];
	},

	writeContentToFile: function *() {
		try {
			this.transformToOneToOne();
			var srcFile = this.getFirstFile();
			if (srcFile) {
				yield srcFile.writeContentToFile();
			}
		}
		catch (error) {
			throw new VError(error, 'SrcCollection#writeContentToFile error');
		}
	}
};

module.exports = SharkTreeSrcCollection;