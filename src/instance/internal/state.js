import Watcher from '../../watcher'
import { compileAndLinkProps } from '../../compiler/index'
import Dep from '../../observer/dep'
import {
  observe,
  defineReactive
} from '../../observer/index'

import {
  warn,
  query,
  hasOwn,
  isReserved,
  isPlainObject,
  bind
} from '../../util/index'

export default function (Vue) {
  /**
   * Accessor for `$data` property, since setting $data
   * requires observing the new object and updating
   * proxied properties.
   */

  Object.defineProperty(Vue.prototype, '$data', {
    get () {
      return this._data
    },
    set (newData) {
      if (newData !== this._data) {
        this._setData(newData)
      }
    }
  })

  /**
   * Setup the scope of an instance, which contains:
   * - observed data
   * - computed properties
   * - user methods
   * - meta properties
   */

  Vue.prototype._initState = function () {
    this._initProps()
    this._initMeta()
    this._initMethods()
    this._initData()
    this._initComputed()
  }

  /**
   * Initialize props.
   */

  Vue.prototype._initProps = function () {
    var options = this.$options
    var el = options.el
    var props = options.props
    //如果没有传入el,则告警
    if (props && !el) {
      process.env.NODE_ENV !== 'production' && warn(
        'Props will not be compiled if no `el` option is ' +
        'provided at instantiation.',
        this
      )
    }
    // make sure to convert string selectors into element now
    //根据配置,获取el对象, 并且把el和options.el都指向该对象
    el = options.el = query(el)
    //如果el存在,并且el是元素, 并且props不为空的情况下,执行编译并且连接属性, 并赋值给属性_propsUnlinkFn, 否则赋值null
    this._propsUnlinkFn = el && el.nodeType === 1 && props
      // props must be linked in proper scope if inside v-for
      ? compileAndLinkProps(this, el, props, this._scope)
      : null
  }

  /**
   * Initialize the data.
   */

  Vue.prototype._initData = function () {
    var dataFn = this.$options.data
    //这里说明,this.$options.data必须为函数
    var data = this._data = dataFn ? dataFn() : {}
    //如果data不是普通对象,则重置data为空对象,并告警
    if (!isPlainObject(data)) {
      data = {}
      process.env.NODE_ENV !== 'production' && warn(
        'data functions should return an object.',
        this
      )
    }
    var props = this._props
    // proxy data on instance
    var keys = Object.keys(data)
    var i, key
    i = keys.length
    //遍历data中所有的key值, 并对这些key值的存取操作都代理到this._data的操作上来
    while (i--) {
      key = keys[i]
      // there are two scenarios where we can proxy a data key:
      // 1. it's not already defined as a prop
      // 2. it's provided via a instantiation option AND there are no
      //    template prop present
      //这里其实是为了防止props中的key值,和data中的key值发生冲突, 发生冲突,则告警key已经存在与props中了!
      if (!props || !hasOwn(props, key)) {
        this._proxy(key)
      } else if (process.env.NODE_ENV !== 'production') {
        warn(
          'Data field "' + key + '" is already defined ' +
          'as a prop. To provide default value for a prop, use the "default" ' +
          'prop option; if you want to pass prop values to an instantiation ' +
          'call, use the "propsData" option.',
          this
        )
      }
    }
    // observe data
    observe(data, this)
  }

  /**
   * Swap the instance's $data. Called in $data's setter.
   *
   * @param {Object} newData
   */

  Vue.prototype._setData = function (newData) {
    newData = newData || {}
    var oldData = this._data
    this._data = newData
    var keys, key, i
    // unproxy keys not present in new data
    keys = Object.keys(oldData)
    i = keys.length
    while (i--) {
      key = keys[i]
      if (!(key in newData)) {
        this._unproxy(key)
      }
    }
    // proxy keys not already proxied,
    // and trigger change for changed values
    keys = Object.keys(newData)
    i = keys.length
    while (i--) {
      key = keys[i]
      if (!hasOwn(this, key)) {
        // new property
        this._proxy(key)
      }
    }
    oldData.__ob__.removeVm(this)
    observe(newData, this)
    this._digest()
  }

  /**
   * Proxy a property, so that
   * vm.prop === vm._data.prop
   *
   * @param {String} key
   */
  //代理该key: 其实就是对key的任何赋值操作,其实都是对self._data的赋值, 对key的任何取值操作,都是对self._data的读取操作
  //等于是对key的所有操作,都代理到了self._data对象上面来了
  Vue.prototype._proxy = function (key) {
    if (!isReserved(key)) {
      // need to store ref to self here
      // because these getter/setters might
      // be called by child scopes via
      // prototype inheritance.
      var self = this
      Object.defineProperty(self, key, {
        configurable: true,
        enumerable: true,
        get: function proxyGetter () {
          return self._data[key]
        },
        set: function proxySetter (val) {
          self._data[key] = val
        }
      })
    }
  }

  /**
   * Unproxy a property.
   *
   * @param {String} key
   */

  Vue.prototype._unproxy = function (key) {
    if (!isReserved(key)) {
      delete this[key]
    }
  }

  /**
   * Force update on every watcher in scope.
   */

  Vue.prototype._digest = function () {
    for (var i = 0, l = this._watchers.length; i < l; i++) {
      this._watchers[i].update(true) // shallow updates
    }
  }

  /**
   * Setup computed properties. They are essentially
   * special getter/setters
   */

  function noop () {}
  Vue.prototype._initComputed = function () {
    var computed = this.$options.computed
    if (computed) {
      for (var key in computed) {
        var userDef = computed[key]
        var def = {
          enumerable: true,
          configurable: true
        }
        if (typeof userDef === 'function') {
          def.get = makeComputedGetter(userDef, this)
          def.set = noop
        } else {
          def.get = userDef.get
            ? userDef.cache !== false
              ? makeComputedGetter(userDef.get, this)
              : bind(userDef.get, this)
            : noop
          def.set = userDef.set
            ? bind(userDef.set, this)
            : noop
        }
        Object.defineProperty(this, key, def)
      }
    }
  }

  function makeComputedGetter (getter, owner) {
    var watcher = new Watcher(owner, getter, null, {
      lazy: true
    })
    return function computedGetter () {
      if (watcher.dirty) {
        watcher.evaluate()
      }
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }

  /**
   * Setup instance methods. Methods must be bound to the
   * instance since they might be passed down as a prop to
   * child components.
   */

  Vue.prototype._initMethods = function () {
    var methods = this.$options.methods
    if (methods) {
      for (var key in methods) {
        this[key] = bind(methods[key], this)
      }
    }
  }

  /**
   * Initialize meta information like $index, $key & $value.
   */

  Vue.prototype._initMeta = function () {
    var metas = this.$options._meta
    if (metas) {
      for (var key in metas) {
        defineReactive(this, key, metas[key])
      }
    }
  }
}
