import type {ReactNode} from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import HomepageFeatures from '@site/src/components/HomepageFeatures';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function HomepageHeader() {
    return (
        <header className={clsx('hero hero--dark', styles.heroBanner)}>
            <div className="container">
                <div className="row">
                    <div className="col col--8 col--offset-2">
                        <Heading as="h1" className="hero__title">
                            Hi, I'm Ouwesh Seeroo
                        </Heading>
                        <p className="hero__subtitle">
                            Senior Java Developer | Tech Enthusiast
                        </p>
                        <div className={styles.buttons}>
                            <Link
                                className="button button--primary button--lg margin-right--md"
                                to="/docs/intro">
                                About Me
                            </Link>
                            <Link
                                className="button button--primary button--secondary button--lg"
                                href="https://ouwesh.com"
                                target="_blank"
                                rel="noopener noreferrer">
                                View My CV
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}

export default function Home(): ReactNode {
    const {siteConfig} = useDocusaurusContext();
    return (
        <Layout
            title={`${siteConfig.title} | Senior Java Developer`}
            description="Personal wiki and blog of Ouwesh Seeroo - Senior Java Developer sharing knowledge and experiences in software development.">
            <HomepageHeader />
            <main>
                <section className="padding-vert--xl">
                    <div className="container">
                        <div className="row">
                            <div className="col col--8 col--offset-2">
                                <h2 className="text--center">Welcome to My Digital Garden</h2>
                                <p className="text--center">
                                    I'm a Senior Java Developer with 4+ years of experience building scalable, high-performance systems.
                                    This is where I share my knowledge, experiences, and thoughts on software development, technology,
                                    and everything in between.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
                <HomepageFeatures />
            </main>
        </Layout>
    );
}
