require('should');
const Promise = require('bluebird');
const sinon = require('sinon');
const Resource = require('../../../lib/resource');
const HtmlHandler = require('../../../lib/resource-handler/html');

const HtmlImgSrcsetTag = require('../../../lib/resource-handler/path-containers/html-img-srcset-tag');
const HtmlCommonTag = require('../../../lib/resource-handler/path-containers/html-common-tag');
const CssText = require('../../../lib/resource-handler/path-containers/css-text');

describe('ResourceHandler: Html', () => {
	let downloadChildrenPaths, htmlHandler;

	beforeEach(() => {
		downloadChildrenPaths = sinon.stub().usingPromise(Promise).resolves();
	});

	describe('constructor', () => {
		describe('sources', () => {
			it('should initialize sources if updateMissingSources was not passed', () => {
				const sources = [{ selector: 'img', attr: 'src'}];
				htmlHandler = new HtmlHandler({sources}, {downloadChildrenPaths});

				htmlHandler.downloadSources.should.eql(sources);
				htmlHandler.updateSources.should.eql([]);
				htmlHandler.allSources.should.eql(sources);
			});

			it('should initialize sources if updateMissingSources = false', () => {
				const sources = [{ selector: 'img', attr: 'src'}];
				htmlHandler = new HtmlHandler({sources, updateMissingSources: false}, {downloadChildrenPaths});

				htmlHandler.downloadSources.should.eql(sources);
				htmlHandler.updateSources.should.eql([]);
				htmlHandler.allSources.should.eql(sources);
			});

			it('should initialize sources if updateMissingSources = true', () => {
				const sources = [{ selector: 'img', attr: 'src'}];
				htmlHandler = new HtmlHandler({sources, updateMissingSources: true}, {downloadChildrenPaths});

				htmlHandler.downloadSources.should.eql(sources);
				htmlHandler.updateSources.should.eql(sources);
				htmlHandler.allSources.should.eql(sources);
			});

			it('should initialize sources if updateMissingSources is array of sources', () => {
				const sources = [{ selector: 'img', attr: 'src'}];
				const updateMissingSources = [{ selector: 'a', attr: 'href'}];
				htmlHandler = new HtmlHandler({sources, updateMissingSources}, {downloadChildrenPaths});

				htmlHandler.downloadSources.should.eql(sources);
				htmlHandler.updateSources.should.eql(updateMissingSources);
				htmlHandler.allSources.should.eql([{ selector: 'img', attr: 'src'}, { selector: 'a', attr: 'href'}]);
			});

			it('should initialize sources without duplicates if updateMissingSources is array of sources', () => {
				const sources = [{ selector: 'img', attr: 'src'}];
				const updateMissingSources = [{ selector: 'img', attr: 'src'}, { selector: 'a', attr: 'href'}];
				htmlHandler = new HtmlHandler({sources, updateMissingSources}, {downloadChildrenPaths});

				htmlHandler.downloadSources.should.eql(sources);
				htmlHandler.updateSources.should.eql(updateMissingSources);
				htmlHandler.allSources.should.eql([{ selector: 'img', attr: 'src'}, { selector: 'a', attr: 'href'}]);
			});
		});
	});

	describe('<base> tag', () => {
		beforeEach(() => {
			htmlHandler = new HtmlHandler({ sources: [] }, {downloadChildrenPaths});
		});

		it('should remove base tag from text and update resource url for absolute href', () => {
			const html = `
				<html lang="en">
				<head>
					<base href="http://some-other-domain.com/src">
				</head>
				<body></body> 
				</html>
			`;
			const resource = new Resource('http://example.com', 'index.html');
			resource.setText(html);

			return htmlHandler.handle(resource).then(() =>{
				resource.getUrl().should.be.eql('http://some-other-domain.com/src');
				resource.getText().should.not.containEql('<base');
			});
		});

		it('should remove base tag from text and update resource url for relative href', () => {
			const html = `
				<html lang="en">
				<head>
					<base href="/src">
				</head>
				<body></body> 
				</html>
			`;
			const resource = new Resource('http://example.com', 'index.html');
			resource.setText(html);

			return htmlHandler.handle(resource).then(() => {
				resource.getUrl().should.be.eql('http://example.com/src');
				resource.getText().should.not.containEql('<base');
			});
		});

		it('should not remove base tag if it doesn\'t have href attribute', () => {
			const html = `
				<html lang="en">
				<head>
					<base target="_blank">
				</head>
				<body></body> 
				</html>
			`;
			const resource = new Resource('http://example.com', 'index.html');
			resource.setText(html);

			return htmlHandler.handle(resource).then(() => {
				resource.getUrl().should.be.eql('http://example.com');
				resource.getText().should.containEql('<base target="_blank">');
			});
		});
	});

	it('should not encode text to html entities', () => {
		htmlHandler = new HtmlHandler({ sources: [] }, {downloadChildrenPaths});
		const html = `
			<html>
			<body>
				<p>Этот текст не должен быть преобразован в html entities</p>
			</body>
			</html>
		`;

		const resource = new Resource('http://example.com', 'index.html');
		resource.setText(html);

		return htmlHandler.handle(resource).then(() => {
			resource.getText().should.containEql('Этот текст не должен быть преобразован в html entities');
		});
	});

	it('should call downloadChildrenResources for each source', () => {
		const sources = [{ selector: 'img', attr: 'src' }];
		htmlHandler = new HtmlHandler({sources}, {downloadChildrenPaths});

		const html = `
			<html lang="en">
			<head></head>
			<body>
				<img src="a.png">
				<img src="b.png">
				<img src="c.png">
			</body>
			</html>
		`;

		const resource = new Resource('http://example.com', 'index.html');
		resource.setText(html);

		return htmlHandler.handle(resource).then(() =>{
			htmlHandler.downloadChildrenPaths.calledThrice.should.be.eql(true);
		});
	});

	it('should not call downloadChildrenResources if source attr is empty', () =>{
		const sources = [{ selector: 'img', attr: 'src' }];
		htmlHandler = new HtmlHandler({sources}, {downloadChildrenPaths});

		const html = `
			<html lang="en">
			<head></head>
			<body><img src=""></body>
			</html>
		`;

		const resource = new Resource('http://example.com', 'index.html');
		resource.setText(html);

		return htmlHandler.handle(resource).then(() =>{
			htmlHandler.downloadChildrenPaths.called.should.be.eql(false);
		});
	});

	it('should use correct path containers based on tag', () => {
		const sources = [
			{ selector: 'img', attr: 'src' },
			{ selector: 'img', attr: 'srcset' },
			{ selector: '.styled', attr: 'style' }
		];
		htmlHandler = new HtmlHandler({sources}, {downloadChildrenPaths});

		const html = `
			<html lang="en">
			<head></head>
			<body>
				<img src="a.png">
				<img srcset="b.png">
				<div class="styled" style="background-image: url(\'c.png\')"></div>
			</body>
			</html>
		`;

		const resource = new Resource('http://example.com', 'index.html');
		resource.setText(html);

		return htmlHandler.handle(resource).then(() =>{
			htmlHandler.downloadChildrenPaths.calledThrice.should.be.eql(true);
			htmlHandler.downloadChildrenPaths.args[0][0].should.be.instanceOf(HtmlCommonTag);
			htmlHandler.downloadChildrenPaths.args[1][0].should.be.instanceOf(HtmlImgSrcsetTag);
			htmlHandler.downloadChildrenPaths.args[2][0].should.be.instanceOf(CssText);
		});
	});

	it('should remove SRI check for loaded resources', () => {
		const sources = [
			{ selector: 'script', attr: 'src'}
		];
		htmlHandler = new HtmlHandler({sources}, {downloadChildrenPaths});

		const html = `
			<html>
			<head>
				<link href="http://examlpe.com/style.css" integrity="sha256-gaWb8m2IHSkoZnT23u/necREOC//MiCFtQukVUYMyuU=" rel="stylesheet">
			</head>
			<body>
				<script integrity="sha256-X+Q/xqnlEgxCczSjjpp2AUGGgqM5gcBzhRQ0p+EAUEk=" src="http://example.com/script.js"></script>
			</body>
			</html>
		`;

		const resource = new Resource('http://example.com', 'index.html');
		resource.setText(html);

		// before handle should contain both integrity checks
		resource.getText().should.containEql('integrity="sha256-gaWb8m2IHSkoZnT23u/necREOC//MiCFtQukVUYMyuU="');
		resource.getText().should.containEql('integrity="sha256-X+Q/xqnlEgxCczSjjpp2AUGGgqM5gcBzhRQ0p+EAUEk="');

		return htmlHandler.handle(resource).then(() => {
			// after handle should contain integrity check for styles
			// but not contain integrity check for script because it was loaded
			resource.getText().should.containEql('integrity="sha256-gaWb8m2IHSkoZnT23u/necREOC//MiCFtQukVUYMyuU="');
			resource.getText().should.not.containEql('integrity="sha256-X+Q/xqnlEgxCczSjjpp2AUGGgqM5gcBzhRQ0p+EAUEk="');
		});
	});
});
