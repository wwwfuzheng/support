/**
 * Support 帮助中心 v5.0版本 异步加载详情 支持类目、标题搜索 基于kissy1.3
 * @author  fuzheng 桐人
 * @date    2013-4-2
 * @updatelog 
 *	v2.0 支持基于hash的后退
 *	v3.0 增加了对空页面的跳转控制
 *  v4.0 升级为基于hash的单页面应用，JS库改为基于KISSY
 * 一些约定：所有调用均基于id, key/keyList均为id(string), 所有title均调用store.getTitleById(id)得出
 */
KISSY.add('support', function(S, Store, XTemplate){
	var DOM = S.DOM,
		Event = S.Event;

	var IFRAME_PROXY_HTML = '<iframe id="J_IframeProxy" class="ks-hidden"/>',
		IFRAME_PROXY_CONTENT_TMEP = '<html><head></head><body><div id="J_Proxy">{hash}</div></body></html>',
		CRUMB_TEMP = '<a href="#{hash}">{title}</a> &gt; ',
		MAIN_TEMP = ['<div class="sub-board">',
			'{{#each mainData}}',
			'<div class="c-box">',
				'{{#if isleaf}}',
					'<h3><a href="#detail={{id}}">{{title}}</a></h3>',
				'{{else}}',
					'<h3>{{title}}</h3>',
					'{{set hasList=false hasDetail=false}}',
					'{{#each children}}',
						'{{#if isleaf === false}}',
							'{{#if hasList === false}}<p>{{/if}}',
							'<a href="#list={{id}}">{{title}}</a>',
							'{{set hasList=true}}',
						'{{/if}}',
					'{{/each}}',
					'{{#if hasList === true}}</p>{{/if}}',
					'{{#each children}}',
						'{{#if isleaf === true}}',
							'{{#if hasDetail === false}}<ul class="clearfix">{{/if}}',
							'<li><a href="#detail={{id}}" title="{{title}}">&sdot;&nbsp;{{setEllipsis title 16}}</a></li>',
							'{{set hasDetail=true}}',
						'{{/if}}',
					'{{/each}}',
					'{{#if hasDetail === true}}</ul>{{/if}}',
				'{{/if}}',
			'</div>',
			'{{/each}}',
		'</div>'].join(''),
		LIST_TEMP = ['<div class="list-board">',
			'<div class="crumbs">{{{crumbs}}}</div>',
			'<div class="list-area"><ul>',
			'{{#each listData}}',
				'<li><a href="#detail={{id}}">{{title}}</a></li>',
			'{{/each}}',
			'</ul></div>',
		'</div>'].join(''),
		DETAIL_TEMP = ['<div class="detail-board">',
			'<div class="crumbs">{{{crumbs}}}</div>',
			'<div class="detail-area">',
				'<h1>{{title}}</h1>',
				'{{{detailData}}}',
			'</div>',
		'</div>'].join(''),
		SEARCH_TEMP = ['<div class="list-board">',
			'<div class="crumbs">{{{crumbs}}}</div>',
			'<div class="list-area"><ul>',
			'{{#each searchData}}',
				'<li><a href="#{{type}}={{id}}">{{{valuePath}}}</a></li>',
			'{{/each}}',
			'</ul></div>',
		'</div>'].join(''),
		SUB_TEMP = ['{{#each subData}}',
			'<li data-key={{id}}>',
				'<a href="#main={{id}}" class="fl" title="{{title}}">{{setEllipsis title 9}}</a>',
				'<ul>',
				'{{#each children}}',
					'<li><a href="#{{#if isleaf}}detail{{else}}main{{/if}}={{id}}" data-key="{{id}}" class="J_MenuItem" title="{{title}}">{{setEllipsis title 9}}</a></li>',
				'{{/each}}',
				'</ul>',
		'{{/each}}'].join(''),
		NOPAGE_TITLE = '对不起，您要找的页面不存在，请查看其他帮助信息。',
		INDEX_TITLE = '帮助中心',
		SEARCH_TITLE = '搜索结果',
		DETAIL_TITLE = '详细内容';

	function Support(config){
		var _self = this;
		Support.superclass.constructor.call(_self, config);	
		_self.events = [
			'indexSetted'
		];
		_self._init();
	}
	
	Support.ATTRS = {
		categoryUrl: {},
		detailUrl: {},
		mainTemp: {
			value: 	MAIN_TEMP
		},
		listTemp: {
			value: 	LIST_TEMP
		},
		detailTemp: {
			value: 	DETAIL_TEMP
		},
		searchTemp: {
			value: 	SEARCH_TEMP
		},
		subTemp: {
			value: 	SUB_TEMP
		},
		crumbTemp: {
			value: 	CRUMB_TEMP
		},
		noPageTitle: {
			value: 	NOPAGE_TITLE
		},
		indexTitle: {
			value: 	INDEX_TITLE
		},
		searchTitle: {
			value: 	SEARCH_TITLE
		},
		detailTitle: {
			value: 	DETAIL_TITLE
		},
		mappingType: {
			value: ['main=', 'list=', 'detail=', 'index', 'search=']
		}
	};

	S.extend(Support, S.Base);

	S.augment(Support, {
		// 初始化
		_init: function(){
			var _self = this;
			// 初始化数据对象
			_self._initStore();
			// 初始化事件
			_self._initEvent();
			// 初始化dom
			_self._initDom();
			// 载入数据
			_self._initData();
		},
		// 初始化数据对象
		_initStore: function(){
			var _self = this,
				store = new Store({
					categoryUrl: _self.get('categoryUrl'),
					detailUrl: _self.get('detailUrl')
				});
			_self.set('store', store);
		},
		// 初始化事件
		_initEvent: function(){
			var _self = this,
				store = _self.get('store');
			// 类目数据加载完成
			store.on('categoryLoaded', function(e){
				// 设置侧边栏
				_self.setSubCon(e.data);
				// 初始化 hash 及 监听
				_self._initHash();
			});
			// 详情数据加载完成
			store.on('detailLoaded', function(e){
				_self._setDetailCon(e.title, e.detail, e.id);
			});
			// 搜索完成
			store.on('searchCategory', function(e){
				var searchData = _self._sortSearchData(e.text, e.pathList, e.valuePathList);
				_self.setSearchCon(searchData);
			});

			// 搜索
			if(S.get('#J_SupportSearch')){
				S.one('#J_SupportSearch').on('click', function(){
					var searchInput = S.one('#J_SupportSearchInput'),
						searchText = searchInput ? searchInput.val() : '';
					if(!!searchText){
						window.location.hash = '#search=' + searchText;
					}
				});
			}
		},
		// 载入数据
		_initData: function(){
			var _self = this,
				store = _self.get('store');
			store.loadCategoryData();
		},
		// 初始化dom
		_initDom: function(){
			var _self = this,
				mainCon = S.one('#J_MainCon'),
				subCon = S.one('#J_SubCon');
			_self.set('mainCon', mainCon);
			_self.set('subCon', subCon);

			// 保存首页内容
			S.one('#J_HideCon').val(mainCon.html());
			// 设置模板方法
			_self._initTemp();
		},
		// 初始化模板方法
		_initTemp: function(){
			var _self = this;
			XTemplate.addCommand('setEllipsis', function (scopes, option) {
				return _self.setEllipsis(option.params[0], option.params[1]);
			});		
		},
		// 初始化 hash 及 监听
		_initHash: function(){
			var _self = this,
				// 检测初始的hash
				nowHash = window.location.hash.slice(1);
			if(!!nowHash){
				_self.mappingHash(nowHash);
			}
			_self.set('nowHash', nowHash);
			// 设置页面hash监听
			_self.hashListener();
		},

		// 页面hash监听
		hashListener: function(){
			var _self = this,
				_ie;
			// 是否为ie6、7
			_ie = S.UA.ie === 6 || S.UA.ie === 7;
			// ie6、7 下的iframe监听
			if(_ie){
				_self._hashListenerForIe();
			}			
			// 监听hash		
			window.setInterval(function(){
				var hashText = window.location.hash.slice(1),
					nowHash = _self.get('nowHash'),
					proxyHash;
				if(hashText !== nowHash){
					_self.mappingHash(hashText);
					if(_ie){
						_self._keepSameHash(hashText);
					}
					_self.set('nowHash', hashText);
				}
				if(_ie){
					proxyHash = _self._getProxyHash();
					if(proxyHash !== nowHash){
						_self._keepSameHash();
					}
				}
			}, 100); 
		},
		// ie6、7 下的iframe监听
		_hashListenerForIe: function(){
			var _self = this,
				// 创建iframe节点
				iframeProxy = DOM.create(IFRAME_PROXY_HTML),
				nowHash = _self.get('nowHash');
			DOM.append(iframeProxy, document.body);
			iframeProxy = document.frames['J_IframeProxy'];
			iframeProxy.document.designMode = 'on';   
			iframeProxy.document.contentEditable = true;   
			// 保存
			_self.set('iframeProxy', iframeProxy);
			// 重写iframe.document
			_self._resetProxyHash(nowHash);
		},
		// ie6、7 下 重置代理hash
		_resetProxyHash: function(hashStr){
			var _self = this,
				iframeProxy = _self.get('iframeProxy');
			iframeProxy.document.open();   
			iframeProxy.document.writeln(S.substitute(IFRAME_PROXY_CONTENT_TMEP, {hash: hashStr}));   
			iframeProxy.document.close();  				
		},
		// ie6、7 下 获取代理hash
		_getProxyHash: function(){
			var _self = this,
				iframeProxy = _self.get('iframeProxy'),
				proxyCon = iframeProxy.document.getElementById('J_Proxy');
			return proxyCon.innerHTML;
		},
		// ie6、7 下 hash与iframe的数据同步
		_keepSameHash: function(_hash){
			var _self = this,
				nowHash;
			if(_hash !== undefined){
				_self._resetProxyHash(_hash);
			}else{
				nowHash = _self._getProxyHash();
				window.location.hash = '#' + nowHash;
				_self.mappingHash(nowHash);
				_self.set('nowHash', nowHash);
			}			
		},
	
		// 映射hash到页面
		mappingHash: function(_hash){
			var _self = this,
				pageType = null,
				pageId = null,
				mappingType = _self.get('mappingType');

			if(_hash.indexOf('script') === -1){
				if(_hash === ''){
					pageType = 'index';		
				}else{
					S.each(mappingType, function(t){
						if(_hash.indexOf(t) > -1){
							pageType = t.replace('=', '');
							pageId = _hash.slice(t.length);
						}
					});
				}
				if(pageType){
					_self.mappingPage(pageType, pageId);
				}
			}
		},

		// 从类型映射到页面
		mappingPage: function(pageType, pageId){
			var _self = this;
			switch(pageType){
				case 'index': 
					_self.setIndex(pageId);
					break;
				case 'main': 
					_self.setMainCon(pageId);
					break;
				case 'list': 
					_self.setListCon(pageId);
					break;
				case 'detail': 
					_self.setDetailCon(pageId);
					break;
				case 'search': 
					_self.searchByText(pageId);
					break;
			}
		},

		// 根据关键字搜索
		searchByText: function(text){
			var _self = this,
				store = _self.get('store');
			if(!!text){
				store.searchCategory(decodeURIComponent(text));
			}
		},

		// 制作面包削 key 为id
		// config = {key:'', isDetail: true, isSearch: true}
		getCrumb: function(config){
			var _self = this,
				store = _self.get('store'),
				key = config.key,
				isDetail = config.isDetail,
				isSearch = config.isSearch,
				path = store.getPathById(key),
				crumbTemp = _self.get('crumbTemp'),
				crumbsList = [S.substitute(crumbTemp, {hash: 'index', title: _self.get('indexTitle')})];
			if(isSearch){
				crumbsList.push(_self.get('searchTitle'));
			}else{
				for(var i = 0; i < path.length; i++){
					var crumbsText = '',
						_title = store.getTitleById(path[i]),
						_id = path[i];
					if(i !== path.length - 1 && i !== 2){
						crumbsText = S.substitute(crumbTemp, {hash: 'main=' + _id, title: _title});
					}else if(i !== path.length - 1 && i === 2){
						crumbsText = S.substitute(crumbTemp, {hash: 'list=' + _id, title: _title});
					}else{
						if(isDetail){
							crumbsText = _self.get('detailTitle');
						}else{
							crumbsText = _title;
						}
					}
					crumbsList.push(crumbsText);
				}			
			}
			return crumbsList.join('');
		},
		// 设置左侧导航
		setSubCon: function(subData){
			var _self = this,
				subCon = _self.get('subCon'),
				subTempObj = _self.get('subTempObj'),
				subList;

			// 获取模板
			if(!subTempObj){
				subTempObj = new XTemplate(_self.get('subTemp'));
				_self.set('subTempObj', subTempObj);
			}
			// 设置内容
			subCon.html(subTempObj.render({'subData': subData}));

			subList = subCon.children();
			// 设置初始展开
			DOM.addClass(subList[0], 'current');
			// 绑定点击事件
			Event.on(subList, 'click', function(ev){
				DOM.removeClass(subList, 'current');
				DOM.addClass(this, 'current');
			});
		},
		// 右侧菜单当前条目展开并高亮
		setMenu: function(key){
			var _self = this,
				store = _self.get('store'),
				subCon = _self.get('subCon'),
				subList = subCon.children(),
				path = store.getPathById(key),
				menuList = null;
			// 一级目录展开
			DOM.removeClass(subList, 'current');
			S.each(subList, function(el){
				el = S.one(el);
				if(el.attr('data-key') === path[0]){
					el.addClass('current');
					menuList = S.all('.J_MenuItem', el);
					return false;
				}		
			});
			// 二级目录高亮
			DOM.removeClass(menuList, 'highlight');
			if(path[1] && menuList && menuList.length > 0){
				S.each(menuList, function(el){
					el = S.one(el);
					if(el.attr('data-key') === path[1]){
						el.addClass('highlight');
						return false;
					}
				});
			}
		},

		// 设置首页
		setIndex: function(key){
			var _self = this;
			_self._setMainContainer(S.one('#J_HideCon').val());
			_self.fire('indexSetted', {id: key});
		},
		// 设置二级内容
		setMainCon: function(key){
			var _self = this,
				store = _self.get('store'),
				conObj = store.getNodeById(key),
				mainData,
				mainTempObj = _self.get('mainTempObj');		
			if(!conObj.children){
				return false;
			}
			if(conObj.parent === ''){
				mainData = conObj.children;
			}else{
				mainData = [conObj];
			}
			// 获取模板
			if(!mainTempObj){
				mainTempObj = new XTemplate(_self.get('mainTemp'));
				_self.set('mainTempObj', mainTempObj);
			}
			// 设置内容
			_self._setMainContainer(mainTempObj.render({'mainData': mainData}), key);
		},
		// 设置list列表
		setListCon: function(key){
			var _self = this,
				store = _self.get('store'),
				crumbs = _self.getCrumb({key: key}),
				listData = store.getChildrenById(key),
				listTempObj = _self.get('listTempObj');
			if(!listData){
				return false;
			}
			// 获取模板
			if(!listTempObj){
				listTempObj = new XTemplate(_self.get('listTemp'));
				_self.set('listTempObj', listTempObj);
			}
			// 设置内容
			_self._setMainContainer(listTempObj.render({'crumbs': crumbs, 'listData': listData}), key);
		},
		// 整理搜索结果数据
		_sortSearchData: function(searchText, pathList, valuePathList){
			var _self = this,
				store = _self.get('store'),
				categoryMapping = store.getCategoryMapping(),
				searchData = [],
				itemData;
			S.each(valuePathList, function(valuePath, i){
				itemData = {};
				itemData.valuePath = valuePath[valuePath.length - 1].replace(searchText, '<em>' + searchText + '</em>');
				itemData.id = pathList[i][pathList[i].length - 1];
				itemData.type = categoryMapping[itemData.id].isleaf ? 'detail' : 'main';
				searchData.push(itemData);
			});
			return searchData;
		},
		// 设置搜索结果内容
		setSearchCon: function(searchData){
			var _self = this,
				searchTempObj = _self.get('searchTempObj'),
				crumbs = _self.getCrumb({isSearch: true});
			// 获取模板
			if(!searchTempObj){
				searchTempObj = new XTemplate(_self.get('searchTemp'));
				_self.set('searchTempObj', searchTempObj);
			}
			// 设置内容
			_self._setMainContainer(searchTempObj.render({'crumbs': crumbs, 'searchData': searchData}));
		},
		// 设置detail
		setDetailCon: function(key){
			var _self = this,
				store = _self.get('store');
			store.loadDetailData(key);
		},
		// 设置detail内容
		_setDetailCon: function(title, detailData, key){
			var _self = this,
				crumbs = _self.getCrumb({key: key, isDetail: true}),
				detailTempObj = _self.get('detailTempObj');
			if(!detailData){
				title = _self.get('noPageTitle');
			}
			// 获取模板
			if(!detailTempObj){
				detailTempObj = new XTemplate(_self.get('detailTemp'));
				_self.set('detailTempObj', detailTempObj);
			}
			// 设置内容
			_self._setMainContainer(detailTempObj.render({'crumbs': crumbs, 'title': title, 'detailData': detailData}), key);
		},
		// 设置主区域内容
		_setMainContainer: function(container, key){
			var _self = this,
				mainCon = _self.get('mainCon');
			mainCon.html(container);
			// 设置菜单
			_self.setMenu(key);
		},

		// 工具方法 - 省略号
		setEllipsis: function(str, len){
			var _str = '';
			len = len * 1;
			if(str.length > len){
				_str = str.slice(0, len - 1) + '...';
			}else{
				_str = str;
			}
			return _str;
		}

	});

	return Support;

},{requires:['store', 'xtemplate']});


/**
 * Store 帮助中心 - 数据存储类
 * @author  fuzheng 桐人
 * @date    2013-4-2
 */
KISSY.add('store', function(S){
	var DOM = S.DOM,
		Event = S.Event;

	function Store(config){
		var _self = this;
		Store.superclass.constructor.call(_self, config);	
		_self.events = [
			/**  
			* 类目数据加载完成
			* @name Store#categoryLoaded
			* @event  
			* @param {event} e  事件对象
			* @param {Array} e.data 类目数据
			*/
			'categoryLoaded',
			/**  
			* detail数据加载完成
			* @name Store#detailLoaded
			* @event  
			* @param {event} e  事件对象
			* @param {Array} e.title 标题
			* @param {String} e.detail 内容
			*/
			'detailLoaded',
			'searchCategory'
		];
		_self._init();
	}

	Store.ATTRS = {
		categoryUrl: {},
		detailUrl: {},
		categoryMapping: {
			value: 	{}
		},
		categoryData: {
			value: 	null
		}
	};
	
	S.extend(Store, S.Base);

	S.augment(Store, {
		// 初始化
		_init: function(){

		},
		// 加载目录数据
		loadCategoryData: function(){
			var _self = this,
				categoryUrl = _self.get('categoryUrl');
			if(!categoryUrl){
				return;
			}
			_self.ajaxFunc({
				url: categoryUrl
			}, function(data){
				var _self = this,
					categoryData;
				if(data.length > 0){
					categoryData = _self.sortCategoryData(data);
					_self.set('categoryData', categoryData);
					_self.fire('categoryLoaded', {data: categoryData});
				}				
			});
		},
		// 整理系统目录json数据
		sortCategoryData: function(data){
			var _self = this,
				categoryMapping = _self.getCategoryMapping(),
				categoryData = [],
				getParentObj;
			// 根据条件获取父节点
			getParentObj = function(list, deep, id){
				if(deep === 0){
					id = id || '';
					return {
						'id': id,
						'children': list
					};			
				}else{
					return getParentObj(list[list.length-1].children, deep-1, list[list.length-1].id);
				}
			};
			// 整理数据
			S.each(data, function(item){
				var categoryIdList = S.trim(item[item.length - 1]).split('-'),
					categoryIdIndex = 0;	
				
				for(var i = 0; i < item.length - 1; i++){
					var _title = S.trim(item[i]),
						_id,
						categoryObj,
						nextObj,
						parentObj;
					// 跳过空值
					if(_title === ''){
						continue;
					}
					// 获取id 及 建立对象
					_id = S.trim(categoryIdList[categoryIdIndex]);
					categoryObj = {
						'id': _id,
						'title': _title,
						'isleaf': false,
						'children': [],
						'parent': ''
					};	
					// 查看是否本节点为叶子节点
					nextObj = S.trim(item[i + 1]);
					if(nextObj === '' || /^[\d\-]+$/g.test(nextObj)){
						categoryObj.isleaf = true;
					}
					// 建立全局id映射
					categoryMapping[_id] = {
						'title': _title,
						'isleaf': categoryObj.isleaf
					};
					// 插入到现有树形数据中
					parentObj = getParentObj(categoryData, i);
					categoryObj.parent = parentObj.id;
					parentObj.children.push(categoryObj);
					// idIndex加1
					categoryIdIndex ++;
				}
			});
			//S.log(categoryData);
			return categoryData;
		},
		// 获取目录数据
		getCategoryData: function(){
			return this.get('categoryData');
		},
		getCategoryMapping: function(){
			return this.get('categoryMapping');
		},
		// 加载detail数据
		loadDetailData: function(id){
			var _self = this;

			_self.ajaxFunc({
				url: _self.get('detailUrl'),
				data: {'id': id, 'title': _self.getTitleById(id)}
			}, function(data){
				if(data){
					var detailStr = data.detail ? data.detail.replace(/\n|\r/g, '') : '';
					_self.fire('detailLoaded', {'title': data.title, 'detail': detailStr, 'id': data.id});
				}
			});		
		},

		// 获取标题
		getTitleById: function(id){
			var _self = this,
				categoryMapping = _self.getCategoryMapping(),
				title = categoryMapping[id] ? categoryMapping[id].title : '';
			return title;
		},
		// 获取路径
		getPathById: function(id){
			var _self = this;
			return _self.traverseTreeById(id).path;
		},
		// 获取节点
		getNodeById: function(id){
			var _self = this;
			return _self.traverseTreeById(id).node;
		},
		getChildrenById: function(id){
			var _self = this,
				node = _self.getNodeById(id);
			return node ? node['children'] || [] : [];
		},

		/**
		* 遍历树，通过id搜索节点
		* @param {String|Number} id 目标id。 若没有，则返回的皆为空值
		* @return {Object} 返回值： 
				obj.path => 该节点的路径id
				obj.valuePath => 该节点的路经value
				obj.pathNode => 该节点的路经node
				obj.node => 该节点对象
		*/
		traverseTreeById: function(id){
			var _self = this,
				categoryData = _self.getCategoryData(),
				path = [],
				valuePath = [],
				pathNode = [],
				_traverse;

			_traverse = function(nodeData, deep){
				deep = deep || 0;
				if(nodeData){
					for(var i = 0; i < nodeData.length; i++){
						if(nodeData[i]['id'] === id || (!nodeData[i]['isleaf'] && _traverse(nodeData[i]['children'], deep + 1))){
							path[deep] = nodeData[i]['id'];
							valuePath[deep] = nodeData[i]['title'];
							pathNode[deep] = nodeData[i];
							return true;
						}
					}
				}
				return false;			
			};

			if(id){
				_traverse(categoryData);
			}

			return {
				path: path,
				valuePath: valuePath,
				pathNode: pathNode,
				node: pathNode[pathNode.length - 1] || null
			};
		},
		/**
		* 遍历树，通过text搜索节点列表
		* @param {String} text 目标文本。 若没有，则返回的皆为空值
		* @return {Object} 返回值： 
				obj.pathList => 路径id列表
				obj.valuePathList => 路径value列表
				obj.pathNodeList => 路径node列表
		*/
		traverseTreeByText: function(text){
			var _self = this,
				categoryData = _self.getCategoryData(),
				path = [],
				pathNode = [],
				valuePath = [],
				pathList = [],
				pathNodeList = [],
				valuePathList = [],
				_traverse;

			_traverse = function(nodeData, deep){
				deep = deep || 0;
				if(nodeData){
					for(var i = 0; i < nodeData.length; i++){
						var l = path.length - deep - 1;
						for(var j = 0; j < l; j++){
							path.pop();
							valuePath.pop();
							pathNode.pop();
						}
						path[deep] = nodeData[i]['id'];
						valuePath[deep] = nodeData[i]['title'];
						pathNode[deep] = nodeData[i];
						if(nodeData[i]['title'].indexOf(text) > -1){
							pathList.push(S.clone(path));
							valuePathList.push(S.clone(valuePath));
							pathNodeList.push(_self.dataFilter(pathNode));
						}
						if(!nodeData[i]['isleaf']){
							_traverse(nodeData[i]['children'], deep + 1);
						}
					}
				}
			};

			if(text){
				_traverse(categoryData);
			}

			return {
				pathList: pathList,
				pathNodeList: pathNodeList,
				valuePathList: valuePathList
			};
		},
		/**
		* 将节点中的children属性过滤掉
		* @param {Array} data 需要过滤的数据
		* @return {Array} 过滤后的数据
		*/
		dataFilter: function(data){
			var _self = this,
				_data = [];
			S.each(data, function(n){
				var filterData = S.clone(n, function(v, k){
					if(k === 'children'){
						return false;
					}
				});
				_data.push(filterData);			
			});
			return _data;
		},
		// 搜索
		searchCategory: function(searchText){
			var _self = this,
				searchResult = _self.traverseTreeByText(searchText);

			_self.fire('searchCategory', {
				text: searchText,
				pathList: searchResult.pathList,
				valuePathList: searchResult.valuePathList,
				result: searchResult
			});

			return searchResult;
		},
		// 工具方法 - ajax
		ajaxFunc: function(config, func){
			var _self = this,
				ajaxConfig = {
				type: 'get',
				dataType: 'jsonp',
				cache: false,
				crossDomain: true,
				success: function(d){
					func.call(_self, d);
				}
			};
			ajaxConfig = S.merge(ajaxConfig, config);
			S.io(ajaxConfig);
		}
	});

	return Store;

},{requires:[]});