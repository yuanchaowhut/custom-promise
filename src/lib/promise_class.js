/**
 * 自定义Promise class 版本
 */
(function (window) {
    const PENDING = 'pending';   //初始状态
    const RESOLVED = 'resolved'; //成功的状态
    const REJECTED = 'rejected'; //失败状态

    class Promise {

        constructor(excutor) {
            const self = this;      //promise对象实例
            self.status = PENDING;  //状态属性，初始值为pending,代表初始为确定状态
            self.data = undefined;  //用来存储结果数据的属性，初始值为undefined
            self.callbacks = [];


            /**
             * 将promsie状态改为成功,指定成功的value
             * @param value
             */
            function resolve(value) {
                //规定状态只能改一次，如果当前不是pending直接return
                if (self.status !== PENDING) {
                    return;
                }
                self.status = RESOLVED;
                self.data = value;

                //异步调用所有缓存的待执行的成功的回调函数
                if (self.callbacks.length) {
                    //启动一个延迟时间为0的定时器，在定时器的回调函数中执行所有成功的回调
                    setTimeout(() => {
                        self.callbacks.forEach(cbsObj => {
                            cbsObj.onResolved(value);
                        });
                    })
                }
            }

            /**
             * 将promise状态改为失败,指定失败的reason
             * @param reason
             */
            function reject(reason) {
                //规定状态只能改一次，如果当前不是pending直接return
                if (self.status !== PENDING) {
                    return;
                }

                self.status = REJECTED;
                self.data = reason;

                //异步调用所有缓存的待执行的失败的回调函数
                if (self.callbacks.length) {
                    //启动一个延迟时间为0的定时器，在定时器的回调函数中执行所有失败的回调
                    setTimeout(() => {
                        self.callbacks.forEach(cbsObj => {
                            cbsObj.onRejected(reason);
                        });
                    })
                }
            }

            //调用excutor启动异步任务
            try {
                excutor(resolve, reject);
            } catch (error) { //执行器执行出错，当前promise变为失败
                reject(error);
            }
        }

        /**
         * 用来指定成功或失败的回调函数的方法，返回一个新的Promise对象.
         *  下面说的"当前promise"指的是调用.then()的promise.
         *  1、如果当前promise是pending，保存回调函数
         *  2、如果当前promise是resolved，异步执行成功回调onResolved
         *  3、如果当前promise是rejected，异步执行失败回调onRejected
         *
         * 新promise对象：
         *  它的结果状态由onResolved或onRejected的执行结果决定。
         *  1、抛异常：变为rejected，结果值为error
         *  2、返回值不是promise：变为 resolved，结果值为返回值
         *  3、返回值promise：由这个promise决定新的promise的结果(成功/失败)
         * @param onResolved
         * @param onRejected
         */
        then(onResolved, onRejected) {
            const self = this;

            //当onResolved或onRejected不存在时，将结果往下传递.
            onResolved = typeof onResolved === 'function' ? onResolved : (value) => value;
            onRejected = typeof onRejected === 'function' ? onRejected : (reason) => {
                throw reason
            };

            //返回新的promsie对象
            return new Promise((resolve, reject) => {

                /**
                 * 抽出一个处理返回结果的公共方法
                 * 1、调用指定的回调函数callback
                 * 2、根据callback()的执行结果来更新then()返回的promise的状态
                 * @param callback
                 * @param value
                 */
                function handle(callback, value) {
                    try {
                        const result = callback(value);
                        if (result instanceof Promise) {
                            //通过.then()获取返回的promise的结果
                            // result.then(
                            //     value => resolve(value),
                            //     reason => reject(reason)
                            // );
                            //等价简化写法
                            result.then(resolve, reject);
                        } else {
                            resolve(result);
                        }
                    } catch (error) {
                        reject(error);
                    }
                }

                if (self.status === RESOLVED) {
                    setTimeout(() => {
                        handle(onResolved, self.data);
                    })
                } else if (self.status === REJECTED) {
                    setTimeout(() => {
                        handle(onRejected, self.data);
                    })
                } else {//pending
                    //callbacks中保存的不是简单的onResolved、onRejected函数，而是我们包装了一层后的函数(包装的目的是要处理返回值的相关逻辑)
                    self.callbacks.push({
                        onResolved: (value) => {
                            handle(onResolved, value);
                        },
                        onRejected: (reason) => {
                            handle(onRejected, reason);
                        }
                    });
                }
            });
        }

        /**
         * 用来指定失败的回调函数的方法
         * catch 是then的语法糖
         * @param onRejected
         */
        catch(onRejected) {
            return this.then(undefined, onRejected);
        }

        /**
         * 用来返回一个指定value的成功的Promise对象
         * value 可以是一个一般值也可以是一个promise对象
         * @param value
         */
        static resolve(value) {
            return new Promise((resolve, reject) => {
                if (value instanceof Promise) {
                    value.then(resolve, reject);  //当value是一个promise时，返回的promise对象的结果由它的结果决定。
                } else {
                    resolve(value);
                }
            });
        }

        /**
         * 用来返回一个指定reason的失败的Promise对象
         */
        static reject(reason) {
            return new Promise((resolve, reject) => {
                reject(reason);
            });
        }

        /**
         * 接收Promise数组，返回一个新的Promise对象
         * 特点：只有当数组中所有Promise都成功了才成功，否则一个失败就整个失败
         * @param promises
         */
        static all(promises) {

            return new Promise((resolve, reject) => {
                let resolvedCount = 0;
                const values = new Array(promises.length);
                promises.forEach((promise, index) => {
                    promise.then((value) => {
                        values[index] = value;
                        resolvedCount++;
                        if (promises.length === resolvedCount) {
                            resolve(values);
                        }
                    }, (reason) => {
                        reject(reason);
                    });
                })
            });
        }

        /**
         * 接收Promise数组，返回一个新的Promise对象
         * 特点：数组中第一个完成(改变状态)的Promise，决定新Promise的结果，第一个完成的Promise成功则新Promise成功，失败同理。
         * @param promises
         */
        static race(promises) {
            return new Promise((resolve, reject) => {
                //依次遍历每一个promise获取其结果，谁先执行完就以谁的结果为准，并且不用担心后面继续执行的promise会影响结果，
                // 因为return出去的promise只能改变一次状态，前面在resolve()、reject()中有相关判断。
                promises.forEach((promise) => {
                    promise.then(resolve, reject);
                })
            });
        }

        /**
         * 返回一个延迟指定时间才成功的promise(当value是promise时也可能返回的失败的promise)
         * @param value
         * @param time
         */
        static resolveDelay(value, time) {

            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (value instanceof Promise) {
                        //当value是一个promise时，返回的promise对象的结果由它的结果决定。
                        value.then(resolve, reject);
                    } else {
                        resolve(value);
                    }
                }, time);
            })
        }

        /**
         * 返回一个延迟指定时间才失败的promise
         * @param value
         * @param time
         */
        static rejectDelay(value, time) {

            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    reject(value);
                }, time);
            })
        }
    }

    window.Promise = Promise;
})(window);
