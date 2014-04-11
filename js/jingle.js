//     Jingle.js 1.0
//     (c) 2014-2014 Kingsy lin, DocumentCloud and Investigative Reporters & Editors
//     Backbone may be freely distributed under the MIT license.
//     For all details and documentation:
//     http://jingle.wasz.cn
(function($){
	var Jingle = {}
	//tempaltes
	$(function(){
		Jingle._templates = {};
		$('[data-role="template"]').each(function(){
			var id = this.id;
			var template = $(this);
			template.remove();
			template.removeAttr('id');
			template.removeAttr('data-role');
			template.find('[data-role=template]').remove();
			template = template.prop('outerHTML');
			Jingle._templates[id] = template;
		});
	});
	//view
	Jingle.View = function(){
		this.properties = {
			el : 'div'
		};
		this.$ = function(selector){
			return this.$el.find(selector);
		};
		this.initialize = function(properties,arguments){
			var options = arguments.length == 1 ? arguments[0] : {};
			this.parent = options.parent;
			this.collection = options.collection;
			this.model = options.model;
			this.router = options.router;
			$.extend(this,this.properties,properties);
			this.$el =  $('<' + this.el +'>'+'</' + this.el +'>');
			if(this.template){
				if(this.template.indexOf('#') == 0){
					var templateId = this.template.substring(1);
					var template = Jingle._templates[templateId];
					//如果没有自定义构造方法并参数个数大于1
					if(!options.initialize){
						var model = options.model || {};
						//解析表达式
						template = template.replace(/[$][{]\w+[}]/g,function(expr){
							var name = expr.substring(2,expr.length-1);
							var value = model.get ? model.get(name) : '';
							if(!value) return '';
							return value;
						});
					}
					this.$el =  $(template);
				}else{
					this.$el.append(this.template);
				}
			}
			var events = this.events;
			if(properties.initialize){
				properties.initialize.apply(this,arguments);
			}else if(this.parent){
				this.$el.appendTo(this.parent);
			}
			for(var name in events){
				var array = name.split(' ');
				var eventType = array[0];
				var eventSelector = array[array.length - 1];
				var eventFnName = events[name];
				this.$(eventSelector).bind(eventType,$.proxy(this,eventFnName));
			}
		};
	};
	Jingle.View.extend = function(options){
		var obj  = function(){
			 this.initialize(options,arguments);
		};
		obj.prototype = new Jingle.View();
		return obj;
	};
	//model
	Jingle.Model = function(){
		this.idAttribute = "id";
		this.defaults = {};
		this.initialize = function(options,arguments){
			$.extend(this,this.options,options);
			var data = this.toJSON(arguments);
			this.attributes = $.extend({},this.defaults,data);
		};
		this.fill = function(data){
			var data = this.toJSON(data);
			$.extend(this.attributes,data);
		}
		this.toJSON = function(data){
			if(!data){
				if(!this.attributes){
					this.attributes = {};
				}
				return this.attributes;
			}
			if(data instanceof Array){
				var json = {};
				for(var i=0;i<data.length;i++){
					var o = data[i];
					json[o.name] = o.value; 
				}
				return json;
			}else{
				return data;
			}
		};
		this.get = function(name){
			return this.attributes[name];
		};
		this.set = function(name,value){
			this.attributes[name] = value;
		};
		this.setId = function(value){
			this.attributes[this.idAttribute] = value;
		};
		this.getUrl = function(method){
			return this.urlRoot + '/' + method;
		},
		this.sync = function(method,callback){
			var self = this;
			var url = this.getUrl(method);
			$.post(url,this.toJSON(),function(rest){
				if(callback){
					if(!(rest instanceof Object)){
					  try{
						rest = JSON.parse(rest);
					  }catch(e){}
					}
					callback.call(self,rest);
				}
			}).error(this.error);
		};
		this.insert = function(data,callback){
			var self = this;
			this.fill(data);
			this.sync('insert',function(rest){
				if(self.collection){
					self.collection.add(self);
				}
				if(callback){
					callback.call(self,rest);
				}
			});
		};
		this.update = function(data,callback){
			this.fill(data);
			this.sync('update',callback);
		};
		this.delete = function(callback){
			var self = this; 
			this.sync('delete',function(rest){
				if(self.collection){
					self.collection.remove(self);
				}
				if(callback){
					callback.call(self,rest);
				}
			});
		};
	};
	Jingle.Model.extend = function(options){
		var obj  = function(arguments){
			 this.initialize(options,arguments);
		};
		obj.prototype = new Jingle.Model();
		obj.options = options;
		return obj;
	};
	//collection
	Jingle.Collection = function(){
		this.model = undefined;
		this.initialize = function(options){
			$.extend(this,this.options,options);
			var options = this.model.options;
 			this.error = this.error || options.error;
			if(!this.url){
				if(options.getUrl){
					this.url = options.getUrl('list');
				}else{
					this.url = options.urlRoot + '/list';
				}
			}
			this.models = new Array();
		};
		this.each = function(callback){
			$(this.models).each(callback);
		};
		this.add = function(model){
			if(!(model instanceof this.model)){
				throw new Error('model类型不匹配');
				return;
			}
			this.models.push(model);
		};
		this.getAt = function(index){
			return this.models[index];
		};
		this.getById = function(id){
			for(var index=0; index < this.models.length; index++){
				var model = this.models[index];
				if(model.get(model.idAttribute) == id){
				  return model;
				}
			}
			return undefined;
		};
		this.remove = function(model){
			for(var index=0; index < this.models.length; index++){
				if(this.models[index] == model){
				   this.models.splice(index, 1);
				}
			}
		};
		this.clear =  function(){
			 this.models.splice(0,this.models.length);  
		};
		this.fill = function(jsonArray){
			var self = this;
			$.each(jsonArray,function(){
				var json = this;
				var model = new self.model(json);
				model.collection = self;
				self.add(model);
			});
		};
		this.fetchOnce = function(options){
			this.fetch(options,true);
		};
		this.fetch = function(options,once){
			var self = this;
			var success = options.success ? options.success : options;
			if(once && this.fetched){
				success.call(self);
				return ;
			}
			var url = this.url;
			$.ajax({
				url : url,
				type: 'POST',
				dataType : 'json',
				error: this.error||options.error,
				success: function(rest){
					if(self.parse){
					   rest = self.parse(rest);
					}
					self.clear();
					self.fill(rest);
					if(success){
						success.call(self);
					}
				},
				complete: function(){
					self.fetched = true;
				}
			});
		};
		this.insert = function(data,callback){
			var model = new this.model(); 
			model.collection = this;
			model.insert(data,callback);
		}
	};
	Jingle.Collection.extend = function(options){
		var obj  = function(){
			 this.initialize(options);
		};
		obj.prototype = new Jingle.Collection();
		return obj;
	};
	//router
	Jingle.Router = function(){
		this.initialize = function(properties,arguments){
			$.extend(this,properties);
			if(properties.initialize){
				properties.initialize.apply(this,arguments);
			}
			var routers = properties.routers;
			if(routers){
				for(var name in routers){
					var fnName = routers[name];
					Jingle.Router.add(name,this,fnName);
				}
			}
		};
		this.navigate = function(name){
			Jingle.Router.navigate(name,this);
		};
	};
	Jingle.Router.extend = function(options){
		var obj  = function(){
			 this.initialize(options,arguments);
		};
		obj.prototype = new Jingle.Router();
		return obj;
	};
	Jingle.Router.navigate = function(name,routerObj){
		var hash = window.location.hash;
		if(hash.length > 0){
			hash = hash.substring(1);
		}
		if(routerObj == true && hash != name){
			window.location.hash = name;
			return;
		};
		if(name == undefined || name == null){
			name = hash;
		}
		var routers;
		if(routerObj instanceof Jingle.Router){
			routers = [routerObj]; 	
		}else{
			routers = Jingle.Router.routers
		}
		if(!routers){
			return;
		}
		for(var i = 0; i < routers.length; i++){
			var routerMap = routers[i].routerMap;
			if(!routerMap){
				continue;
			}
			var found = false; 
			for(var router in routerMap){
				if(name == '' && router != ''){
					continue;
				}
				if(name != '' && router == ''){
					continue;
				}
				var expr = new RegExp(router);
				var array = name.match(expr); 
				if(array == null){
					continue;
				}
				array =	array.splice(1, 1);
				var params = routerMap[router];
				var context = params[0];
				if(context.onNavigate){
					context.onNavigate();
				}
				var method = params[1];
				var fn = context[method];
				fn.apply(context,array);
				found = true;
				break;
			}
			if(found){
				break;
			}
		}
	};
	Jingle.Router.add = function(name,context,method){
		if(!context.routerMap){
			context.routerMap = {};
		}
		var routerMap = context.routerMap;
		name = name.replace(/:(\w+)/g,function(a){
			return '(\\w+)';
		});
		routerMap[name] = [context,method];
		var routers = Jingle.Router.routers;
		if(!routers){
			Jingle.Router.routers = routers = new Array();
		}
		var exists = false;
		for(var i=0; i < routers.length;i++){
			if(routers[i] = context){
				exists = true;
				break;
			}
		}
		if(!exists){
			routers.push(context);
		}
	};
	Jingle.Router.start = function(){
		Jingle.Router.navigate();
		Jingle.Router.onhashchange = function(){
			Jingle.Router.navigate();
		};
		$(window).bind('hashchange',Jingle.Router.onhashchange);
	};
	window.Jingle = Jingle;
})($);//Zepto or jQuery