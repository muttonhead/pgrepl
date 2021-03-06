package net.squarelabs.pgrepl.db

import com.google.gson.GsonBuilder
import com.google.inject.Guice
import net.squarelabs.pgrepl.DefaultInjector
import net.squarelabs.pgrepl.model.Snapshot
import net.squarelabs.pgrepl.model.Transaction
import net.squarelabs.pgrepl.services.*
import org.flywaydb.core.Flyway
import org.junit.After
import org.junit.Assert
import org.junit.Before
import org.junit.Test
import org.postgresql.core.BaseConnection
import java.util.*
import java.util.concurrent.TimeUnit

class ReplicatorTest {

    private val injector = Guice.createInjector(DefaultInjector())!!
    private val cfgSvc = injector.getInstance(ConfigService::class.java)!!
    private val conSvc = injector.getInstance(ConnectionService::class.java)!!
    private val snapSvc = injector.getInstance(SnapshotService::class.java)!!
    private val dbSvc = injector.getInstance(DbService::class.java)!!
    private val slotSvc = injector.getInstance(SlotService::class.java)!!

    @Before
    @Throws(Exception::class)
    fun setup() {
        val dbName = cfgSvc.getAppDbName()
        val url = cfgSvc.getJdbcDatabaseUrl()
        if (dbSvc.list().contains(dbName)) dbSvc.drop(dbName)
        dbSvc.create(dbName)
        val flyway = Flyway()
        flyway.setDataSource(cfgSvc.getAppDbUrl(), null, null)
        flyway.migrate()
    }

    @After
    fun tearDown() {
        conSvc.reset()
    }

    @Test
    fun shouldReceiveNotifications() {
        val dbName = cfgSvc.getAppDbName()
        val clientId = UUID.randomUUID()
        val conString = cfgSvc.getAppDbUrl()
        var snap: Snapshot? = null
        conSvc.getConnection(conString).use {
            snap = snapSvc.takeSnapshot(it.unwrap(BaseConnection::class.java))
        }
        val actual = mutableListOf<String>()
        val spy = { lsn: Long, json: String ->
            actual.add(json)
            Unit
        }
        Replicator(dbName, clientId, snap!!.lsn, cfgSvc, slotSvc, conSvc).use {
            it.addListener(clientId, spy)
            conSvc.getConnection(conString).use { conA ->
                conSvc.getConnection(conString).use { conB ->
                    // test interleave
                    conA.autoCommit = false
                    conB.autoCommit = false
                    conA.prepareStatement("INSERT INTO person (id, name, \"curTxnId\") VALUES (1, 'Brent', 'd55cad5c-03da-405f-af3a-13788092b33c');").use {
                        it.executeUpdate()
                    }
                    conB.prepareStatement("INSERT INTO person (id, name, \"curTxnId\") VALUES (2, 'Rachel', '794d1570-ce12-4371-9304-0d50cce518ca');").use {
                        it.executeUpdate()
                    }
                    conA.prepareStatement("INSERT INTO person (id, name, \"curTxnId\") VALUES (3, 'Emma', 'ee52c2be-8690-4bbb-9cac-a4aa5e7ca81e');").use {
                        it.executeUpdate()
                    }
                    conB.prepareStatement("INSERT INTO person (id, name, \"curTxnId\") VALUES (4, 'Annie', '36bc5f56-2c7d-4147-af72-f03bd1443e9e');").use {
                        it.executeUpdate()
                    }
                    conA.commit()
                    conB.commit()

                    // test update
                    conA.prepareStatement("UPDATE person SET name='Justin' WHERE name='Brent';").use {
                        it.executeUpdate()
                    }
                    conA.commit()

                    // test delete
                    conA.prepareStatement("DELETE FROM person WHERE name='Justin';").use {
                        it.executeUpdate()
                    }
                    conA.commit()
                }
            }
            while (actual.size < 4) TimeUnit.MILLISECONDS.sleep(10)
        }

        // Assert
        //Assert.assertEquals("Two transactions should have been committed", 2, actual.size)
        val gson = GsonBuilder().setPrettyPrinting().create()
        val expected = this.javaClass.getResource("/fixtures/txn.json").readText()
        val actualAr = actual.map { gson.fromJson(it, Transaction::class.java) }
        val expectedAr: List<Transaction> = gson.fromJson(expected, Array<Transaction>::class.java)
                .mapIndexed { idx, txn ->
                    txn.copy(
                            xid = actualAr[idx].xid,
                            nextlsn = actualAr[idx].nextlsn,
                            timestamp = actualAr[idx].timestamp
                    )
                }
        val actualJson = gson.toJson(
                actualAr.mapIndexed { idx, txn -> txn.copy(clientTxnId = expectedAr[idx].clientTxnId) }
        )
        val expectedJson = gson.toJson(expectedAr)
        Assert.assertEquals("Replicator should send notifications", expectedJson, actualJson)
    }

}