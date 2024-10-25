// TODO: Either remove some invalid... for safeerror or include more excs

class InvalidArch extends Error {
    /**
     * @param {string} arch
     */
    constructor(arch) {
        const message = `invalid architecture: ${arch}`;
        super(message);

        this.name = "InvalidArch";
    }
}

class InvalidOS extends Error {
    /**
     * @param {string} os
     */
    constructor(os) {
        const message = `invalid OS: ${os}`;
        super(message);

        this.name = "InvalidOS";
    }
}

class InvalidInstanceName extends Error {
    constructor() {
        const message = `instance name cannot be empty`;
        super(message);

        this.name = "InvalidInstanceName";
    }
}

class InvalidInstanceType extends Error {
    /**
     * @param {string} instanceType
     */
    constructor(instanceType) {
        const message = `invalid instance type: ${instanceType}`;
        super(message);

        this.name = "InvalidInstanceType";
    }
}

class CouldNotFetch extends Error {
    /**
     * @param {string} url
     * @param {Response} response
     */
    constructor(url, response) {
        const message = `couldn't fetch ${url} - ${response.statusCode} ${response.statusText}`;
        super(message);

        this.name = "CouldNotFetch";
    }
}

class InvalidVersion extends Error {
    /**
     * @param {string} version
     */
    constructor(version) {
        const message = `invalid version: ${version}`;
        super(message);

        this.name = "InvalidVersion";
    }
}

class SafeError extends Error {
    /**
     * @param {string} message
     */
    constructor(message) {
        super(message);

        this.name = "SafeError";
    }
}

export {
    CouldNotFetch, InvalidArch, InvalidInstanceType, InvalidOS, InvalidInstanceName, InvalidVersion, SafeError
};
