import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default {
    target: 'node',
    mode: 'production',
    context: __dirname,
    devtool: 'source-map',
    entry: path.resolve(__dirname, 'src/index.ts'),
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'index.js',
        pathinfo: true,
        libraryTarget: 'umd',
    },
    optimization: {
        minimize: false,
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                loader: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    // Modules provided by Tabby itself at runtime — must not be bundled
    externals: {
        'tabby-core': 'commonjs tabby-core',
        'tabby-settings': 'commonjs tabby-settings',
        'tabby-terminal': 'commonjs tabby-terminal',
        '@angular/core': 'commonjs @angular/core',
        '@angular/common': 'commonjs @angular/common',
        '@angular/forms': 'commonjs @angular/forms',
        '@ng-bootstrap/ng-bootstrap': 'commonjs @ng-bootstrap/ng-bootstrap',
        'rxjs': 'commonjs rxjs',
        'rxjs/operators': 'commonjs rxjs/operators',
    },
}
