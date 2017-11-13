#!/usr/bin/env bash


echo Changing ownership of /tmp/docker-mailserver volume
chown -R node.node /tmp/docker-mailserver

exec gosu node tini -- "$@"
