import { def, indexOf } from '../util/index'

//获取Array的原型属性对象
const arrayProto = Array.prototype
//定义一个arrMethods对象,该对象的原型就是Array.prototype对象,即arrMethods对象继承了Array.prototype的所有方法
export const arrayMethods = Object.create(arrayProto)

/**
 * Intercept mutating methods and emit events
 */
//这里给arrMethods对象重新定义了以下方法
;[
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]
.forEach(function (method) {
  // cache original method 缓存arrayProto上的方法
  var original = arrayProto[method]

  //重新定义arrayMethods上的方法, 其value是一个mutator函数
  def(arrayMethods, method, function mutator () {
    // avoid leaking arguments:
    // http://jsperf.com/closure-with-arguments
    //将arguments的值都拷贝到args数组中
    var i = arguments.length
    var args = new Array(i)
    while (i--) {
      args[i] = arguments[i]
    }

    var result = original.apply(this, args)
    var ob = this.__ob__
    var inserted
    switch (method) {
      case 'push':
        inserted = args
        break
      case 'unshift':
        inserted = args
        break
      case 'splice':
        inserted = args.slice(2)
        break
    }
    if (inserted) ob.observeArray(inserted)
    // notify change
    ob.dep.notify()
    return result
  })
})

/**
 * Swap the element at the given index with a new value
 * and emits corresponding event.
 *
 * @param {Number} index
 * @param {*} val
 * @return {*} - replaced element
 */

def(
  arrayProto,
  '$set',
  function $set (index, val) {
    if (index >= this.length) {
      this.length = Number(index) + 1
    }
    return this.splice(index, 1, val)[0]
  }
)

/**
 * Convenience method to remove the element at given index or target element reference.
 *
 * @param {*} item
 */

def(
  arrayProto,
  '$remove',
  function $remove (item) {
    /* istanbul ignore if */
    if (!this.length) return
    var index = indexOf(this, item)
    if (index > -1) {
      return this.splice(index, 1)
    }
  }
)
