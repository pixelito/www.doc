<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * The dev `app` container exports APP_ENV, DB_*, SESSION_DRIVER, etc. as real
     * environment variables. Those shadow phpunit.xml's <env> entries (PHPUnit's
     * `force` only updates getenv(), not the $_ENV array Laravel reads), and they
     * also win over any .env file because Dotenv is immutable. So we pin the test
     * environment at runtime here — after the app boots, before the database
     * traits run — to keep the suite isolated on the dedicated test database and
     * out of "production" CSRF behaviour.
     */
    protected function refreshApplication()
    {
        parent::refreshApplication();

        $this->app['env'] = 'testing';

        $this->app['config']->set([
            'app.env' => 'testing',
            'database.default' => 'pgsql',
            'database.connections.pgsql.database' => 'wwwdoc_test',
            'session.driver' => 'array',
            'queue.default' => 'sync',
            'cache.default' => 'array',
        ]);
    }
}
